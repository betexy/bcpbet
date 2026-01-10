
{
  "name": "Betexy Bot",
  "description": "#VERSION#",
  "background": {
    "service_worker": "background.js"
  },
    "content_scripts": [
        {
            "all_frames": true,
            "js": [
                "libs/jquery-3.3.1.min.js",
                "libs/helper.js",
                "libs/staticcache.js"
            ],
            "matches": [
                "*://*.staticcache.org/*",
                "*://*.scoreboards.red7mobile.com/*"
            ]
        },
        {
            "all_frames": true,
            "js": [
                "libs/jquery-3.3.1.min.js",
                "libs/html2canvas.min.js",
                "libs/helper.js",
                "libs/recaptcha.js"
            ],
            "matches": [
                "https://www.google.com/recaptcha/api2/*"
            ]
        },
        {
            "all_frames": true,
            "js": [
                "libs/jquery-3.3.1.min.js",
                "libs/js.cookie.min.js",
                "libs/helper.js",
                "js/safecharge.js"
            ],
            "matches": [
                "https://secure.safecharge.com/*"
            ]
        },
        {
            "all_frames": true,
            "js": [
                "js/contentScriptCheck.js"
            ],
            "matches": [
                "*://*/*"
            ]#DOCUMENT_START#
        }
        #INCLUDE_JS_FOR#
#CONTENT_SCRIPTS#
    ],
  "declarative_net_request": {
    "rule_resources": [{
      "id": "block_yandex_metrika",
      "enabled": true,
      "path": "rules.json"
    }]
  },
  "permissions": [
    "storage",
    "offscreen",
    "tabs",
    "activeTab",
    "nativeMessaging",
    "management",
    "webRequest",
    "webNavigation",
    "notifications",
    "debugger",
    "clipboardRead",
    "declarativeNetRequest",
    "declarativeNetRequestWithHostAccess",
    "scripting"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },
  "web_accessible_resources": [
    {
      "resources": [
        #DIRECT_RESOURCES#
      ],
      "matches": [
        "<all_urls>"
      ]
    }
  ],
  "manifest_version": 3,
  "version": "2.0",
  "icons": {
    "128": "icon.png"
  },
  "action": {
    "default_popup": "options.html",
    "default_icon": {
      "128": "icon.png"
    }
  },
  "host_permissions": [
    "<all_urls>",
    "http://*/*",
    "https://*/*"
  ]
}