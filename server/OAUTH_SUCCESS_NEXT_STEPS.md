# ✅ OAuth Connection Successful!

## Connected Account

- **Email:** greg@bidlow.co.uk
- **Display Name:** Greg Visser
- **Customer ID:** test-customer-1
- **Status:** Active
- **Daily Send Limit:** 150 emails

## What You Can Do Now

### 1. Create Email Campaigns

Your Outlook account is now connected and ready to use for email campaigns.

**Steps:**
1. Open your CRM application
2. Navigate to the "Email Campaigns" tab
3. Click "Create Campaign" or "New Campaign"
4. Select `greg@bidlow.co.uk` as the sender email
5. Configure your campaign settings:
   - Campaign name and description
   - Send time windows
   - Follow-up delay settings
6. Create email templates (initial and follow-up)
7. Add prospects/contacts to the campaign
8. Start the campaign

### 2. Test the Connection

You can verify the connection works by:

**API Endpoint:**
```
GET http://localhost:3001/api/outlook/identities?customerId=test-customer-1
```

This will return a list of all connected email accounts for the customer.

### 3. Connect Additional Accounts

If you need to connect more Outlook accounts:

1. Use the OAuth flow again:
   ```
   http://localhost:3001/api/outlook/auth?customerId=test-customer-1
   ```
2. Sign in with a different Microsoft account
3. Grant the required permissions
4. The account will be added to the database

### 4. Background Services

The server automatically runs:
- **Email Scheduler**: Sends emails at scheduled times
- **Reply Detection**: Monitors inbox for replies every 5-10 minutes

These services started automatically when the server started.

### 5. Campaign Features

Once you create a campaign, you'll have access to:
- **Email Sending**: Automated sending based on schedules
- **Open Tracking**: Track when emails are opened
- **Reply Detection**: Automatically detect and record replies
- **Unsubscribe Handling**: Manage opt-out requests
- **Performance Metrics**: View detailed campaign analytics

## Troubleshooting

### If Emails Don't Send

1. Check server logs for errors
2. Verify the account is active in the database
3. Check daily send limits
4. Ensure templates are properly configured

### If Replies Aren't Detected

1. Wait 5-10 minutes (reply detection runs periodically)
2. Check server logs for reply detection worker messages
3. Verify the account has Mail.Read permission

### If You Need to Reconnect

1. The OAuth tokens will automatically refresh when needed
2. If refresh fails, use the OAuth flow again to reconnect
3. The system will update the existing account record

## Database Record

The connection details are stored in the `EmailIdentity` table:
- Access tokens (encrypted/stored securely)
- Refresh tokens for automatic token renewal
- Token expiration times
- Account status and limits

## Next: Create Your First Campaign!

1. Use the Email Campaigns UI in your CRM
2. Or use the API endpoints:
   - `POST /api/campaigns` - Create campaign
   - `POST /api/campaigns/:id/templates` - Add templates
   - `POST /api/campaigns/:id/prospects` - Add prospects
   - `POST /api/campaigns/:id/start` - Start campaign

Good luck with your email campaigns! 🚀

