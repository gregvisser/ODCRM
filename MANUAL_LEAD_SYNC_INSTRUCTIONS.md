# 🔄 Manual Lead Sync Instructions

**Time:** 3:31 PM  
**Status:** Ready to sync leads from Google Sheets

---

## ✅ **You've Added Google Sheets to 13 Accounts**

Great! The system is ready to import leads.

---

## 🔄 **How to Manually Trigger Lead Sync:**

### **Option 1: Restart Render Service** (Fastest)

1. **Go to:** https://dashboard.render.com/web/srv-d5ldkn4mrvns73edi4rg
2. **Click:** "Manual Deploy" button at the top
3. **Confirm:** This will restart the service
4. **Result:** Lead sync runs immediately on startup

**ETA:** Leads will import in ~1-2 minutes

---

### **Option 2: Wait for Automatic Sync** (Easiest)

The leads sync worker runs **every 10 minutes** automatically.

**Next sync:** Within the next 10 minutes  
**What happens:** System checks all 13 customers with Google Sheets URLs and imports their leads

**No action needed** - just wait!

---

### **Option 3: Use Render Shell** (If you're comfortable)

1. Go to: https://dashboard.render.com/web/srv-d5ldkn4mrvns73edi4rg/shell
2. Wait for shell to connect
3. Run: `curl http://localhost:3001/api/leads?sync=true`
4. This triggers immediate sync

---

## 📊 **What Will Happen After Sync:**

Once leads are imported, your dashboard will show:

✅ **Actual lead counts** (Week 3 data showing 11 leads from Google Sheets)
✅ **Channel breakdown:**
   - Telesales: 51 leads (44%)
   - LinkedIn: 24 leads (21%)  
   - Reply: 1 lead (1%)
   - Email: 41 leads (35%)

✅ **Team member rankings:**
   - Adam: Top performer
   - Jack, etc.

✅ **Month-to-Date:** 116 leads

✅ **Progress bars** will fill up

✅ **No more glitching!**

---

## 🎯 **Recommended:**

**Just click "Manual Deploy" in Render** - this is the fastest way to trigger the sync immediately.

**Dashboard:** https://dashboard.render.com/web/srv-d5ldkn4mrvns73edi4rg

Click the blue "Manual Deploy" button → Wait 1-2 minutes → Leads will appear!

---

**Status:** System ready to sync. Waiting for manual trigger or automatic sync cycle.
