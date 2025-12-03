# DNS Configuration for trashmarket.fun

To connect your domain to GitHub Pages, log in to your domain registrar (e.g., Namecheap, GoDaddy, Cloudflare) and update your DNS records with the following.

## 1. A Records (Apex Domain)
Delete any existing A records for `@` or `trashmarket.fun` and add these four:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A    | @    | 185.199.108.153 | Automatic / 3600 |
| A    | @    | 185.199.109.153 | Automatic / 3600 |
| A    | @    | 185.199.110.153 | Automatic / 3600 |
| A    | @    | 185.199.111.153 | Automatic / 3600 |

## 2. CNAME Record (Subdomain)
This ensures `www.trashmarket.fun` redirects to your site.

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME | www | dogecoin87.github.io | Automatic / 3600 |

## Verification
After updating these records, it may take up to 24 hours (usually < 1 hour) for the changes to propagate. 

You can check the status in your GitHub Repository under **Settings > Pages**. 
Ensure "Custom domain" is set to `trashmarket.fun` and "Enforce HTTPS" is checked.
