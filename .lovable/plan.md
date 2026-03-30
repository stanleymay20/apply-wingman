

## Plan: Complete Email Domain Setup + End-to-End Pipeline Verification

### Current State

After investigation:
- **Scheduled automation**: Already updated with `triggerAutoApply` logic and service role key in cron headers — this is done.
- **Delivery status dashboard + retry**: Already added to Applications page — this is done.
- **Email domain**: **NOT configured**. No email domains exist in the workspace. This is the blocker for all email-based applications.

### What Needs to Happen

#### Step 1: Set Up Email Domain (scrolllibrary.app)

The email domain must be configured through Lovable's email infrastructure. This will:
- Register `scrolllibrary.app` as a sending domain
- Provide you with the exact DNS records (DKIM, SPF, DMARC) to add at your domain registrar
- Once DNS propagates and verifies, emails from `jobs@scrolllibrary.app` will deliver

Click below to start the setup:

<lov-actions>
  <lov-open-email-setup>Set up email domain</lov-open-email-setup>
</lov-actions>

#### Step 2: After Domain Verified — Wire Up Email Infrastructure

Once the domain is verified, I will:
- Set up the email sending infrastructure (queues, logging, cron processing)
- Update the `auto-apply` edge function sender to use the verified domain
- Deploy all functions

#### Step 3: End-to-End Test

After email is live:
- Trigger one discovery cycle manually
- Verify a high-match job gets auto-applied (ATS method)
- Send one test email application to your own inbox
- Confirm logs appear in `application_logs` and `notifications`

### Action Required From You

**Click "Set up email domain" above**, then add the DNS records it provides at your domain registrar for `scrolllibrary.app`. Once verified, I will complete steps 2 and 3.

