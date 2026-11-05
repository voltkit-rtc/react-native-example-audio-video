/**
 * Android refuses http:// and ws:// in a release build. Production uses https, so nothing is
 * opened there. When the configured backend is plain http (a laptop on the LAN, or the emulator's
 * 10.0.2.2), this allows cleartext for that one host and leaves everything else https-only.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

const FILE = 'network_security_config';

function xml(hosts) {
  const domains = hosts.map((h) => `    <domain includeSubdomains="false">${h}</domain>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
${domains}
  </domain-config>
</network-security-config>
`;
}

module.exports = function withDevCleartext(config, { hosts = [] } = {}) {
  if (hosts.length === 0) return config;

  config = withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    app.$['android:networkSecurityConfig'] = `@xml/${FILE}`;
    return c;
  });

  return withDangerousMod(config, [
    'android',
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${FILE}.xml`), xml(hosts));
      return c;
    },
  ]);
};
