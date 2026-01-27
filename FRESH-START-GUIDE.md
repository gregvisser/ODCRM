# 🚀 Fresh Start: Building a Clean Customer System

## ✨ Your Clean Slate Advantages

Starting fresh means you can:
- ✅ **No legacy data issues** - Clean, consistent data from day one
- ✅ **Better data structure** - Follow modern best practices
- ✅ **Proper validation** - Enforce data quality from the start
- ✅ **Cloud-first approach** - Everything in Azure database (no localStorage confusion)
- ✅ **Automated workflows** - Set up integrations properly from the beginning

---

## 🎯 Quick Start: Create Your First Customer

### Option 1: Via UI (Easiest)

1. **Go to**: http://localhost:5173/?tab=customers-home&view=overview
2. **Click**: "Create New Account" button (orange button top-right)
3. **Fill in the form** with customer details:
   - Name (required)
   - Website/Domain
   - Sector/Industry
   - Monthly spend
   - Lead targets
   - DEFCON level (customer health: 1=critical, 6=excellent)
4. **Click**: "Create" or "Save"
5. **Verify**: Customer appears in the table

### Option 2: Via API (For Bulk Import)

```javascript
// In browser console or via API tool
const customer = {
  name: "Tech Solutions Ltd",
  domain: "techsolutions.com",
  website: "https://www.techsolutions.com",
  sector: "Technology",
  clientStatus: "active",
  targetJobTitle: "CTO, Head of IT",
  prospectingLocation: "London, UK",
  monthlyIntakeGBP: 5000,
  defcon: 4,
  weeklyLeadTarget: 20,
  monthlyLeadTarget: 80,
  leadsReportingUrl: "https://docs.google.com/spreadsheets/d/..."
};

// POST to API
fetch('http://localhost:3001/api/customers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(customer)
});
```

---

## 📊 Modern Data Structure

Your customer records now include:

### Core Information
- **Name** - Company name
- **Domain/Website** - Company website
- **Sector** - Industry/vertical

### Business Details
- **Client Status** - active, inactive, onboarding, win_back
- **DEFCON Level** - Customer health (1-6)
- **Monthly Intake** - Revenue from this customer

### Prospecting
- **Target Job Titles** - Who to reach out to
- **Prospecting Location** - Geographic focus
- **Leads Reporting URL** - Google Sheets link for tracking

### Lead Targets & Performance
- **Weekly Lead Target** - Expected leads per week
- **Monthly Lead Target** - Expected leads per month
- **Weekly/Monthly Actuals** - Auto-tracked from your reporting

### AI-Enriched Data (Auto-populated)
- **Company Profile** - Auto-generated from website
- **What They Do** - Business description
- **Key Leaders** - Leadership team
- **Recent News** - Latest company updates
- **Accreditations** - Certifications/awards

### Customer Contacts (Your POCs)
- **Name, Email, Phone**
- **Title/Role**
- **Primary Contact flag**
- **Notes**

---

## 🔄 Recommended Workflows

### 1. **Onboarding New Customers**

```
Create Customer → Add Contacts → Set Lead Targets → Link Google Sheet → Monitor Performance
```

### 2. **Daily Operations**

```
Check Dashboard → Review DEFCON Levels → Update Lead Actuals → Follow Up on Low Performers
```

### 3. **Monthly Review**

```
Review All Customers → Update Targets → Adjust DEFCON → Plan Next Month
```

---

## 🎨 Best Practices for Clean Data

### ✅ DO:

1. **Use consistent naming**
   - Company names: "Tech Solutions Ltd" (not "tech solutions" or "TechSolutions")
   
2. **Complete core fields**
   - Always fill: Name, Sector, Client Status, DEFCON
   - Optional but useful: Domain, Monthly Intake, Lead Targets

3. **Set realistic targets**
   - Weekly/Monthly lead targets should be achievable
   - Review and adjust quarterly

4. **Update DEFCON regularly**
   - 1-2: Critical (needs immediate attention)
   - 3-4: Healthy (standard monitoring)
   - 5-6: Excellent (low maintenance)

5. **Use Google Sheets integration**
   - Link leads reporting URL
   - System auto-syncs lead data
   - Keeps actuals up-to-date

### ❌ DON'T:

1. **Don't duplicate customers**
   - Check if customer exists before creating
   - System prevents duplicates by name

2. **Don't leave DEFCON empty**
   - Always set a customer health level
   - Default to 3-4 for new customers

3. **Don't mix data formats**
   - Use consistent date formats
   - Use proper URLs (include https://)
   - Use proper currency amounts

---

## 📈 Sample Customer Templates

### Template 1: Technology Company
```json
{
  "name": "CloudTech Solutions",
  "domain": "cloudtech.io",
  "website": "https://cloudtech.io",
  "sector": "Cloud Computing",
  "clientStatus": "active",
  "targetJobTitle": "CTO, VP Engineering, Head of DevOps",
  "prospectingLocation": "UK, Ireland",
  "monthlyIntakeGBP": 8000,
  "defcon": 4,
  "weeklyLeadTarget": 25,
  "monthlyLeadTarget": 100,
  "leadsReportingUrl": "https://docs.google.com/spreadsheets/d/abc123"
}
```

### Template 2: Professional Services
```json
{
  "name": "Legal Partners LLP",
  "domain": "legalpartners.co.uk",
  "website": "https://legalpartners.co.uk",
  "sector": "Legal Services",
  "clientStatus": "onboarding",
  "targetJobTitle": "Managing Partner, Senior Partner, Practice Head",
  "prospectingLocation": "London, Manchester",
  "monthlyIntakeGBP": 5000,
  "defcon": 3,
  "weeklyLeadTarget": 15,
  "monthlyLeadTarget": 60
}
```

### Template 3: Manufacturing
```json
{
  "name": "Industrial Manufacturing Co",
  "domain": "indmfg.com",
  "website": "https://indmfg.com",
  "sector": "Manufacturing",
  "clientStatus": "active",
  "targetJobTitle": "Operations Director, Plant Manager, Supply Chain Director",
  "prospectingLocation": "Midlands, North of England",
  "monthlyIntakeGBP": 12000,
  "defcon": 5,
  "weeklyLeadTarget": 30,
  "monthlyLeadTarget": 120,
  "leadsReportingUrl": "https://docs.google.com/spreadsheets/d/xyz789"
}
```

---

## 🔧 Bulk Import Tool

If you have a spreadsheet with customer data, I can create a bulk import script:

```javascript
// Import from CSV/Excel
const customers = [
  { name: "Customer 1", domain: "customer1.com", sector: "Tech", ... },
  { name: "Customer 2", domain: "customer2.com", sector: "Finance", ... },
  // ... more customers
];

// Bulk create
for (const customer of customers) {
  await fetch('http://localhost:3001/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customer)
  });
}
```

---

## 🎯 Next Steps

### Immediate (Today)
1. ✅ Create your first customer (test with your own company or a sample)
2. ✅ Add 1-2 contacts to that customer
3. ✅ Verify everything saves to database
4. ✅ Test the dashboard views

### This Week
1. Import 3-5 real customers
2. Set up Google Sheets integration for lead tracking
3. Configure email accounts for campaigns
4. Test the reporting dashboard

### This Month
1. Import all active customers
2. Set up automated lead sync
3. Configure AI enrichment for company data
4. Train your team on the new system

---

## 💾 Data Safety

Your data is now:
- ✅ **Stored in Azure PostgreSQL** (cloud database)
- ✅ **Backed up automatically** by Azure
- ✅ **Accessible via API** (can export anytime)
- ✅ **Version controlled** (Prisma migrations tracked)
- ✅ **Secure** (Azure AD authentication)

---

## 📞 Need Help?

Common tasks:
- **Create customer**: Click "Create New Account" button
- **Edit customer**: Click on customer row, edit in drawer
- **Delete customer**: Open customer, click Delete (only if no related data)
- **Add contacts**: Open customer, scroll to Contacts section
- **View dashboard**: Go to "Dashboards" tab
- **Export data**: Use Prisma Studio (http://localhost:5555)

---

## 🎉 You're All Set!

Your clean, modern customer system is ready. Start by creating your first customer and building from there!

**Pro Tip**: The system learns as you use it. The AI will auto-enrich company data, track leads automatically, and generate insights over time.
