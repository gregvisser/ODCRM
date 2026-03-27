# Mailbox deliverability checklist (operator)

Use this for any new sending domain or mailbox (for example test mail from a Microsoft 365 mailbox that lands in Junk). ODCRM can send mail through connected Outlook or SMTP identities, but **inbox placement is not controlled by the app**. Verify the items below **outside** the application.

## DNS authentication (sending domain)

1. **SPF** — Publish a correct SPF record for the domain that sends mail. Include the authorized sources (Microsoft 365, your SMTP provider, or both). Avoid duplicate SPF TXT records and keep lookups within limits.
2. **DKIM** — Enable DKIM signing for the domain in your provider (Microsoft 365: **Microsoft 365 admin center → Email & collaboration → DKIM**; enable and complete CNAME steps as shown).
3. **DMARC** — Publish a DMARC policy (start with `p=none` for monitoring, then tighten). Ensure **alignment** between SPF/DKIM identifiers and the visible `From` domain where you require it.

## Microsoft 365–specific

4. **DKIM enabled** for the domain actually used in the From address (not only SPF).
5. **Outbound connectors / smart hosts** — If you relay through another system, confirm that system is authorized in SPF and that DKIM still applies when required.

## Reputation and volume

6. **Warm-up** — New mailboxes and domains should start with low volume and consistent patterns; avoid sudden spikes from cold addresses.
7. **Outlook / Microsoft sender reputation** — Monitor bounces, complaints, and junk reports in Microsoft 365 and adjust lists and content.
8. **SNDS and JMRP** — For high-volume sending from Microsoft infrastructure, register for [Microsoft SNDS](https://sendersupport.olc.protection.outlook.com/snds/) and [JMRP](https://postmaster.live.com/JMRP/) where applicable to monitor IP reputation signals.

## Content and testing

9. **Sparse test mail** — Very short or generic test messages from a **new** mailbox/domain are more likely to be filtered. Prefer tests that include clear branding, a plain explanation, and both HTML and text where your stack supports it.
10. **Alignment** — Do not expect inbox placement if the From domain, return path, and authentication do not align with your operational setup.

## What ODCRM does not verify

The repository cannot verify live DNS records, Microsoft tenant configuration, or third-party reputation. Use your DNS host, Microsoft 365 admin, and postmaster tools as the source of truth.
