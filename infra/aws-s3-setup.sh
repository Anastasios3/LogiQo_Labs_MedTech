#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LogiQo MedTech — S3 + KMS + IAM bootstrap
# ─────────────────────────────────────────────────────────────────────────────
# Prerequisites:
#   brew install awscli       (or pip install awscli)
#   aws configure             (set admin credentials)
#
# What this script creates:
#   1. AWS KMS customer-managed key (CMK) for S3 server-side encryption
#   2. S3 bucket (logiqo-medtech-documents-dev) — versioning on, public access blocked
#   3. Bucket default encryption policy using the CMK
#   4. IAM user (logiqo-api-dev) + least-privilege inline policy
#   5. Access key pair — printed once, add to .env immediately
#
# Run:
#   chmod +x infra/aws-s3-setup.sh
#   AWS_PROFILE=your-admin-profile ./infra/aws-s3-setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BUCKET="logiqo-medtech-documents-dev"
IAM_USER="logiqo-api-dev"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "──────────────────────────────────────────────────"
echo "LogiQo MedTech — S3 / KMS / IAM Bootstrap"
echo "Account: ${ACCOUNT_ID}  |  Region: ${REGION}"
echo "──────────────────────────────────────────────────"

# ── 1. KMS Customer-Managed Key ──────────────────────────────────────────────
echo ""
echo "▶  Creating KMS CMK for S3 document encryption…"

KMS_KEY_ID=$(aws kms create-key \
  --description "LogiQo MedTech document storage encryption key" \
  --region "${REGION}" \
  --query "KeyMetadata.KeyId" \
  --output text)

# Human-friendly alias so you can reference it by name in the console
aws kms create-alias \
  --alias-name "alias/logiqo-medtech-documents" \
  --target-key-id "${KMS_KEY_ID}" \
  --region "${REGION}"

# Enable automatic key rotation (HIPAA best practice — rotates annually)
aws kms enable-key-rotation \
  --key-id "${KMS_KEY_ID}" \
  --region "${REGION}"

echo "   ✅  KMS key:  ${KMS_KEY_ID}  (alias: logiqo-medtech-documents)"

# ── 2. S3 Bucket ─────────────────────────────────────────────────────────────
echo ""
echo "▶  Creating S3 bucket: ${BUCKET}…"

if [ "${REGION}" = "us-east-1" ]; then
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}"
else
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
fi

# ── Block all public access ───────────────────────────────────────────────────
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "   ✅  Public access: fully blocked"

# ── Enable versioning ─────────────────────────────────────────────────────────
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

echo "   ✅  Versioning: enabled"

# ── Default encryption: KMS CMK ───────────────────────────────────────────────
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration "{
    \"Rules\": [{
      \"ApplyServerSideEncryptionByDefault\": {
        \"SSEAlgorithm\": \"aws:kms\",
        \"KMSMasterKeyID\": \"${KMS_KEY_ID}\"
      },
      \"BucketKeyEnabled\": true
    }]
  }"

echo "   ✅  Default encryption: aws:kms (CMK ${KMS_KEY_ID})"

# ── Deny non-encrypted PutObject (belt-and-suspenders) ───────────────────────
aws s3api put-bucket-policy \
  --bucket "${BUCKET}" \
  --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Sid\": \"DenyNonKMSUploads\",
        \"Effect\": \"Deny\",
        \"Principal\": \"*\",
        \"Action\": \"s3:PutObject\",
        \"Resource\": \"arn:aws:s3:::${BUCKET}/*\",
        \"Condition\": {
          \"StringNotLikeIfExists\": {
            \"s3:x-amz-server-side-encryption-aws-kms-key-id\": \"arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/${KMS_KEY_ID}\"
          }
        }
      }
    ]
  }"

echo "   ✅  Bucket policy: DenyNonKMSUploads applied"

# ── 3. IAM User + Policy ──────────────────────────────────────────────────────
echo ""
echo "▶  Creating IAM user: ${IAM_USER}…"

aws iam create-user --user-name "${IAM_USER}" 2>/dev/null || \
  echo "   ℹ️  IAM user already exists — skipping create"

# Inline least-privilege policy
aws iam put-user-policy \
  --user-name "${IAM_USER}" \
  --policy-name "logiqo-s3-document-access" \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Sid\": \"S3DocumentAccess\",
        \"Effect\": \"Allow\",
        \"Action\": [
          \"s3:PutObject\",
          \"s3:GetObject\",
          \"s3:DeleteObject\",
          \"s3:HeadObject\"
        ],
        \"Resource\": \"arn:aws:s3:::${BUCKET}/*\"
      },
      {
        \"Sid\": \"S3BucketProbe\",
        \"Effect\": \"Allow\",
        \"Action\": [
          \"s3:ListBucket\",
          \"s3:GetBucketLocation\"
        ],
        \"Resource\": \"arn:aws:s3:::${BUCKET}\"
      },
      {
        \"Sid\": \"KMSDocumentEncryption\",
        \"Effect\": \"Allow\",
        \"Action\": [
          \"kms:GenerateDataKey\",
          \"kms:Decrypt\",
          \"kms:DescribeKey\"
        ],
        \"Resource\": \"arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/${KMS_KEY_ID}\",
        \"Condition\": {
          \"StringLike\": {
            \"kms:ViaService\": \"s3.${REGION}.amazonaws.com\"
          }
        }
      }
    ]
  }"

echo "   ✅  Inline policy: logiqo-s3-document-access attached"

# ── 4. Access Key (printed ONCE — copy to .env immediately) ──────────────────
echo ""
echo "▶  Creating access key for ${IAM_USER}…"
ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "${IAM_USER}")

ACCESS_KEY_ID=$(echo "${ACCESS_KEY_OUTPUT}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['AccessKey']['AccessKeyId'])")
SECRET_KEY=$(echo "${ACCESS_KEY_OUTPUT}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['AccessKey']['SecretAccessKey'])")

echo ""
echo "══════════════════════════════════════════════════"
echo "  ⚠️  SECRET KEY DISPLAYED ONCE — COPY NOW"
echo "══════════════════════════════════════════════════"
echo ""
echo "  Add to apps/api/.env:"
echo ""
echo "  AWS_REGION=\"${REGION}\""
echo "  AWS_ACCESS_KEY_ID=\"${ACCESS_KEY_ID}\""
echo "  AWS_SECRET_ACCESS_KEY=\"${SECRET_KEY}\""
echo "  S3_BUCKET=\"${BUCKET}\""
echo "  KMS_KEY_ID=\"${KMS_KEY_ID}\""
echo ""
echo "══════════════════════════════════════════════════"
echo ""
echo "▶  Verifying bucket exists…"
aws s3api head-bucket --bucket "${BUCKET}" && echo "   ✅  Bucket verified: s3://${BUCKET}"

echo ""
echo "✅  Bootstrap complete. Run the connection probe to verify:"
echo "   pnpm --filter @logiqo/api exec tsx src/lib/s3-probe.ts"
echo ""
