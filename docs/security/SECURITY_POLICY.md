# Security Policy for Trash Market DEX

## Overview

This document outlines the security measures, policies, and procedures implemented in the Trash Market DEX to ensure a safe and secure trading environment for all users.

## Security Architecture

### 1. Runtime Security with LavaMoat

**LavaMoat** provides compartmentalization and sandboxing of dependencies to prevent supply chain attacks and malicious package behavior.

#### Implementation
- **Policy Configuration**: `lavamoat.config.json` defines allowed globals and package access
- **Compartmentalization**: Each package operates in its own sandbox with restricted access
- **Whitelist Approach**: Only explicitly allowed globals and packages can be accessed
- **Monitoring**: Inspects critical globals like `window`, `document`, `fetch`, and `crypto`

#### Protected Resources
```json
{
  "root": {
    "globals": ["Buffer", "console", "fetch", "crypto", ...],
    "packages": ["react", "@solana/web3.js", "firebase", ...]
  },
  "@solana/web3.js": {
    "globals": ["Buffer", "crypto", "fetch", ...],
    "packages": ["bs58", "bn.js", "buffer", ...]
  }
}
```

#### Benefits
- ✅ Prevents malicious npm packages from accessing sensitive APIs
- ✅ Restricts unauthorized network access
- ✅ Blocks crypto manipulation attacks
- ✅ Protects localStorage and sessionStorage
- ✅ Prevents DOM manipulation by untrusted code

### 2. Dependency Security

#### Audit Commands
```bash
# Check for vulnerabilities
npm run security:audit

# Check for moderate and higher vulnerabilities
npm run security:check

# Automatically fix vulnerabilities
npm run security:fix
```

#### Dependency Management
- **Version Pinning**: Critical dependencies use exact versions
- **Regular Updates**: Dependencies updated quarterly
- **Audit Trail**: All dependency changes logged
- **Minimal Dependencies**: Only essential packages included

#### Critical Dependencies Monitored
- `@solana/web3.js` - Blockchain interaction
- `@coral-xyz/anchor` - Program interaction
- `firebase` - Backend services
- `react` - UI framework
- `lucide-react` - Icon library

### 3. Code Security Measures

#### Input Validation
```typescript
// Mint address validation (base58 format)
const isValidMintAddress = (address: string): boolean => {
  const base58Regex = /^[1-9A-HJ-NP-Z]{44}$/;
  return base58Regex.test(address);
};

// Numeric input validation
if (!/^\d*\.?\d*$/.test(value)) return; // Reject non-numeric
```

#### Transaction Security
- Wallet connection verification
- Transaction structure validation
- Slippage protection
- Retry limits (max 3 attempts)
- Balance verification before swap

#### API Security
- HTTPS-only communication
- URL parameter encoding
- Response validation
- Error handling without information leakage

### 4. Data Protection

#### Sensitive Data Handling
- **Private Keys**: Never stored or transmitted (wallet adapter handles)
- **Signatures**: Verified on-chain, not stored locally
- **Balances**: Fetched on-demand from RPC
- **Transactions**: Confirmed before considering complete

#### Local Storage
- **Allowed**: User preferences, settings, UI state
- **Forbidden**: Private keys, signatures, sensitive tokens
- **Encrypted**: None required (no sensitive data stored)

### 5. Network Security

#### Communication Protocols
- **HTTPS Only**: All external API calls use HTTPS
- **Certificate Validation**: Automatic via browser/Node.js
- **No Proxies**: Direct connections to trusted APIs
- **Rate Limiting**: Implemented on backend (Cloudflare Worker)

#### Trusted APIs
- `https://gorapi.trashscan.io` - Token/market data
- `https://api.meteora.ag` - Swap quotes and execution
- `https://rpc.trashscan.io` - Gorbagana RPC endpoint

### 6. Frontend Security

#### XSS Prevention
- **React Escaping**: Automatic HTML escaping
- **No innerHTML**: Never used for user content
- **Content Security Policy**: Recommended for deployment
- **Sanitization**: Error messages sanitized before display

#### CSRF Prevention
- **Wallet Signatures**: Required for all transactions
- **Nonce Validation**: Implemented in backend
- **SameSite Cookies**: Configured in backend

#### Clickjacking Prevention
- **X-Frame-Options**: Set to DENY in backend
- **Frame Busting**: Not needed (no sensitive iframes)

### 7. Smart Contract Interaction

#### Program Verification
- **Program ID Validation**: Verified before instruction creation
- **Instruction Validation**: Checked before signing
- **Account Validation**: Verified against expected PDAs
- **Authority Verification**: Wallet signature required

#### Transaction Limits
- **Max Retries**: 3 attempts per transaction
- **Timeout**: Confirmation required within 30 seconds
- **Gas Limits**: Enforced by Solana network

## Vulnerability Disclosure

### Reporting Security Issues

If you discover a security vulnerability, please **do not** open a public GitHub issue. Instead:

1. **Email**: security@trashmarket.fun
2. **Subject**: `[SECURITY] Vulnerability Report`
3. **Details**: 
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline
- **Acknowledgment**: Within 24 hours
- **Assessment**: Within 48 hours
- **Fix Development**: Depends on severity
- **Public Disclosure**: After fix is deployed

### Severity Levels
- **Critical**: Immediate risk to user funds → 24-hour fix
- **High**: Significant security risk → 7-day fix
- **Medium**: Moderate risk → 30-day fix
- **Low**: Minor issue → Next release

## Security Best Practices for Users

### Before Using the DEX

1. **Verify URL**: Always use `https://trashmarket.fun`
2. **Check Address**: Verify contract addresses in official documentation
3. **Test Small**: Start with small amounts to test
4. **Secure Wallet**: Use hardware wallet for large amounts

### During Swaps

1. **Review Details**: Check token pair, amount, and slippage
2. **Verify Price**: Compare with other DEXes
3. **Check Liquidity**: Ensure sufficient liquidity for swap
4. **Monitor Gas**: Adjust priority fee based on network conditions

### After Swaps

1. **Verify Transaction**: Check on block explorer
2. **Confirm Receipt**: Verify tokens in wallet
3. **Report Issues**: Contact support if transaction fails

## Security Monitoring

### Automated Checks
- ✅ TypeScript compilation (strict mode)
- ✅ ESLint code analysis
- ✅ npm audit on every build
- ✅ LavaMoat policy enforcement
- ✅ Dependency vulnerability scanning

### Manual Reviews
- ✅ Code review before merge
- ✅ Security audit quarterly
- ✅ Penetration testing annually
- ✅ Dependency updates reviewed

### Incident Response
1. **Detection**: Automated alerts + manual monitoring
2. **Assessment**: Severity and impact analysis
3. **Containment**: Disable affected features if needed
4. **Remediation**: Deploy fix to production
5. **Post-Mortem**: Document and prevent recurrence

## Compliance

### Standards
- ✅ OWASP Top 10 protection
- ✅ CWE/SANS Top 25 mitigation
- ✅ Solana security best practices
- ✅ Web3 security standards

### Audits
- ✅ Annual third-party security audit
- ✅ Smart contract audit (if applicable)
- ✅ Penetration testing
- ✅ Code review process

## Security Checklist

### Pre-Launch
- [ ] All dependencies audited
- [ ] LavaMoat policy configured
- [ ] Security audit completed
- [ ] Penetration testing passed
- [ ] Code review approved
- [ ] Documentation reviewed

### Post-Launch
- [ ] Monitoring enabled
- [ ] Incident response plan active
- [ ] Security team on-call
- [ ] User communication ready
- [ ] Rollback plan prepared

### Ongoing
- [ ] Weekly security checks
- [ ] Monthly dependency updates
- [ ] Quarterly security audit
- [ ] Annual penetration test
- [ ] Continuous monitoring

## Contact

For security-related inquiries:
- **Email**: security@trashmarket.fun
- **Discord**: [Security Channel]
- **Twitter**: [@TrashMarketFun](https://twitter.com/TrashMarketFun)

## Version History

| Version | Date | Changes |
| :--- | :--- | :--- |
| 1.0 | 2026-03-03 | Initial security policy with LavaMoat integration |

---

**Last Updated**: March 3, 2026  
**Next Review**: June 3, 2026  
**Status**: ✅ Active
