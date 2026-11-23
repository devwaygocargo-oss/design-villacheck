// Generated from server route declarations by tools/generate-api-route-manifest.mjs.
// Resource recognition does not grant authorization or bypass release policy.
const exact=new Set([
  "/api/account/privacy-requests",
  "/api/admin/acceptance",
  "/api/admin/access-roles",
  "/api/admin/accounts",
  "/api/admin/advertisements",
  "/api/admin/audit-log",
  "/api/admin/basic-promotion",
  "/api/admin/change-approvals",
  "/api/admin/checks",
  "/api/admin/cms",
  "/api/admin/cms/carousel",
  "/api/admin/cms/history",
  "/api/admin/cms/media",
  "/api/admin/cms/media/delete",
  "/api/admin/cms/publish",
  "/api/admin/cms/restore",
  "/api/admin/cms/save",
  "/api/admin/email-test",
  "/api/admin/leads",
  "/api/admin/media-upload",
  "/api/admin/merchant-changes",
  "/api/admin/merchant-registrations",
  "/api/admin/merchants",
  "/api/admin/otp/status",
  "/api/admin/owner-notifications",
  "/api/admin/owner-verification",
  "/api/admin/ownership-documents",
  "/api/admin/packages",
  "/api/admin/password-invitation",
  "/api/admin/payments",
  "/api/admin/privacy-requests",
  "/api/admin/promotions",
  "/api/admin/property-media",
  "/api/admin/qr",
  "/api/admin/readiness",
  "/api/admin/receiving-bank",
  "/api/admin/receiving-bank/email",
  "/api/admin/registry-bank-verification",
  "/api/admin/reports",
  "/api/admin/review-sample-document",
  "/api/admin/reviews",
  "/api/admin/settings",
  "/api/admin/settings/demo-villas",
  "/api/admin/social-jobs",
  "/api/admin/social-materials",
  "/api/admin/subscriptions",
  "/api/admin/users",
  "/api/admin/villa-archive",
  "/api/admin/villa-pages",
  "/api/auth/admin-",
  "/api/auth/admin-login",
  "/api/auth/admin-logout",
  "/api/auth/admin-me",
  "/api/auth/admin-password/complete",
  "/api/auth/admin-password/request",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/logout-all",
  "/api/auth/me",
  "/api/auth/oauth/status",
  "/api/auth/otp/request",
  "/api/auth/otp/status",
  "/api/auth/otp/verify",
  "/api/auth/password",
  "/api/auth/recovery/request",
  "/api/auth/recovery/verify",
  "/api/auth/register",
  "/api/auth/register-phone",
  "/api/auth/register-user",
  "/api/auth/register-user-phone",
  "/api/auth/registration/verify",
  "/api/config",
  "/api/health",
  "/api/leads",
  "/api/merchant/analytics",
  "/api/merchant/media-upload",
  "/api/merchant/owner-verification",
  "/api/merchant/ownership-documents",
  "/api/merchant/profile",
  "/api/merchant/property-media",
  "/api/merchant/receiving-bank",
  "/api/merchant/registration",
  "/api/merchant/reports",
  "/api/merchant/reviews",
  "/api/merchant/social-jobs",
  "/api/merchant/social-materials",
  "/api/merchant/villa-archive",
  "/api/merchant/villa-draft",
  "/api/merchant/villa-package",
  "/api/ops/cron",
  "/api/ops/target-attestation",
  "/api/packages",
  "/api/payments/attempt",
  "/api/phase2/catalog",
  "/api/phase2/company-approval-preview",
  "/api/phase2/company-approval-requests",
  "/api/phase2/escalations",
  "/api/phase2/media",
  "/api/phase2/moderate",
  "/api/phase2/notices",
  "/api/phase2/orders",
  "/api/phase2/owner-session",
  "/api/phase2/owner-workspace",
  "/api/phase2/payment",
  "/api/phase2/policy",
  "/api/phase2/promotions",
  "/api/phase2/public",
  "/api/phase2/reply",
  "/api/phase2/review-mode",
  "/api/phase2/reviews",
  "/api/phase2/sandbox",
  "/api/phase2/social",
  "/api/phase2/trial",
  "/api/phase2/workspace",
  "/api/phase2/workspaces",
  "/api/public/advertisements",
  "/api/public/cms",
  "/api/public/events",
  "/api/public/privacy-notice",
  "/api/public/property-media",
  "/api/public/reports",
  "/api/public/reviews",
  "/api/public/villas",
  "/api/reports",
  "/api/reviews",
  "/api/reviews/media",
  "/api/state",
  "/api/subscription",
  "/api/subscription/coupon",
  "/api/subscription/upgrade",
  "/api/user/checks",
  "/api/user/merchant-registration",
  "/api/user/precheck/compare",
  "/api/user/precheck/history",
  "/api/user/precheck/registry",
  "/api/user/precheck/search",
  "/api/user/profile",
  "/api/user/scoped-report",
  "/api/user/summary",
  "/api/villas",
  "/api/webhooks/omise"
]);
const patterns=[
  {
    "pattern": "^\\/api\\/(?:(merchant|admin)\\/registration-documents|social-material-files)\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(?:admin\\/)?documents\\/([a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(?:merchant\\/registration(?:$|-documents\\/)|admin\\/(?:merchant-registrations(?:$|\\/)|registration-documents\\/))",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(?:merchant\\/villas|villas)\\/([a-f0-9-]{36})(?:\\/(review|resubmit))?$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(?:merchant\\/villas|villas|admin\\/qr)\\/([a-f0-9-]+)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(?:reviews\\/[a-f0-9-]{36}\\/appeal|merchant\\/reviews\\/[a-f0-9-]{36}\\/reply|admin\\/reviews\\/[a-f0-9-]{36}\\/moderate)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(?:user|admin)\\/checks(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(admin\\/)?documents\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(admin\\/)?documents\\/([a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(admin\\/payments|payments)\\/([a-f0-9-]+)(\\/status)?$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(merchant|admin)\\/registration-documents\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(merchant|admin)\\/registration-documents\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(public\\/(cms|villas|advertisements|reviews|reports\\/RPT-[a-zA-Z0-9-]+|qr\\/[^/]+|villa-photo\\/[a-f0-9-]+|property-media(?:-file\\/[a-f0-9-]+)?|cms-media\\/[a-f0-9-]+)|(?:admin\\/)?documents\\/[a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(public\\/(qr\\/[^/]+|villa-photo\\/[a-f0-9-]+|property-media-file\\/[a-f0-9-]{36}|cms-media\\/[a-f0-9-]+)|admin\\/qr-verification\\/[^/]+|(?:admin\\/)?documents\\/[a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(public\\/reviews|reviews|admin\\/reviews|merchant\\/reviews)(\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(reviews|admin\\/reviews|merchant\\/reviews)\\/([a-f0-9-]{36})\\/(moderate|appeal|reply)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/(user\\/(?:checks|profile|summary)|reports|merchant\\/(analytics|reports|villas)|admin\\/(checks|reports|merchants|qr))",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(access-roles|role|roles|permissions)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(accounts|leads|qr|subscriptions)\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(accounts|users|merchants)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(documents|review-sample-document)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(gateway|payment-gateway)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(merchant-registrations|registration-documents)\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(merchant-registrations|registration-documents|owner-verification|ownership-documents|bank-evidence)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(packages|leads|settings|subscriptions)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(packages|package-promotions|package-entitlements|basic-promotion)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(packages|package-promotions|package-entitlements|basic-promotion|promotions)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(privacy-requests|owner-notifications)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(receiving-bank|change-approvals)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(reports|tickets|checks|leads)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(reviews|advertisements|social-jobs|social-materials)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(settings|email-test|otp)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/(villa-archive|villa-pages|merchant-changes|property-media|media-upload|qr|qr-verification)(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/accounts(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/accounts\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/accounts\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/change-approvals\\/([a-f0-9-]{36})\\/(approve|reject)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/cms(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/documents\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/leads\\/([a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/merchant-changes\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/merchant-changes\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/merchant-registrations\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/merchant-registrations\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/package-entitlements\\/([a-z0-9_-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/package-promotions\\/([a-z0-9_-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/packages(?:\\/([a-z0-9-]+))?$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/packages\\/[a-z0-9-]+$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/payments(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/payments\\/([a-f0-9-]+)\\/(approve|reject)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/promotions(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/qr-verification\\/[^/]+$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/qr\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/qr\\/([a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/qr\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/receiving-bank\\/notifications\\/([a-f0-9-]{36})\\/retry$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/reports\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/reports\\/([a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/reports\\/[a-f0-9-]+$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/reviews\\/([a-f0-9-]+)\\/moderate$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/reviews\\/[a-f0-9-]+\\/moderate$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/subscriptions(?:\\/|$)",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/admin\\/subscriptions\\/([a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/auth\\/oauth\\/(google|facebook|line)\\/(start|callback|link|reauth)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/auth\\/oauth\\/(google|facebook|line)\\/link$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/auth\\/oauth\\/(google|facebook|line)\\/start$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/auth\\/oauth\\/(google|line)\\/(link|reauth)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/auth\\/oauth\\/(google|line)\\/(start|callback)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/auth\\/oauth\\/(google|line)\\/reauth$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/auth\\/oauth\\/(google|line|facebook)\\/start$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/auth\\/oauth\\/facebook\\/(start|callback)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/invoices\\/([a-f0-9-]+)\\/(proof|confirm|reject)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/invoices\\/[^/]+\\/(confirm|reject)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/mails\\/([a-f0-9-]+)\\/retry$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/merchant\\/registration-documents\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/merchant\\/villas\\/([a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/merchant\\/villas\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/merchant\\/villas\\/[a-f0-9-]+$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/payments\\/([a-f0-9-]+)\\/checkout$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/payments\\/([a-f0-9-]+)\\/demo-slip$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/payments\\/([a-f0-9-]+)\\/omise$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/payments\\/([a-f0-9-]+)\\/qr$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/payments\\/([a-f0-9-]+)\\/slip$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/(cms-media|property-media-file|villa-photo|review-media)\\/",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/cms-media\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/cms-media\\/([a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/cms-media\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/cms-media\\/[a-f0-9-]+$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/property-media-file\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/property-media-file\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/property-media-file\\/[a-f0-9-]+$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/reports\\/(RPT-[A-Za-z0-9-]{1,64})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/review-media\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/review-media\\/[a-f0-9-]{36}$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/villa-photo\\/([a-f0-9-]+)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/public\\/villa-photo\\/[a-f0-9-]+$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/receiving-bank\\/qr\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/reviews\\/([a-f0-9-]+)\\/appeal$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/reviews\\/[a-f0-9-]+\\/appeal$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/social-material-files\\/([a-f0-9-]{36})$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/villas\\/([a-f0-9-]+)\\/(review|resubmit|renew)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/villas\\/([a-f0-9-]+)\\/verification-level$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/villas\\/[^/]+\\/review$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/villas\\/[a-f0-9-]{36}\\/(review|resubmit)$",
    "flags": ""
  },
  {
    "pattern": "^\\/api\\/villas\\/[a-f0-9-]+\\/(review|resubmit)$",
    "flags": ""
  }
].map(({pattern,flags})=>new RegExp(pattern,flags));
export function knownApiPath(path){return exact.has(path)||patterns.some(pattern=>{const match=pattern.exec(path);return match?.index===0&&match[0]===path})}
