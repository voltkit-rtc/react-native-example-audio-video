/**
 * Signs release builds with the app's own key when `credentials/release.properties` exists:
 *
 *   storeFile=voltkit-live-release.jks   (inside credentials/)
 *   storePassword=...
 *   keyAlias=...
 *   keyPassword=...
 *
 * Without that file, release builds keep the debug key, so anyone can still build the app.
 * The key never goes into git; back up the credentials folder, because no update can replace
 * an installed app unless it is signed with the same key.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const PROPS = "rootProject.file('../credentials/release.properties')";

const RELEASE_CONFIG = `
        release {
            def releaseProps = new Properties()
            def releasePropsFile = ${PROPS}
            if (releasePropsFile.exists()) {
                releasePropsFile.withInputStream { releaseProps.load(it) }
                storeFile rootProject.file('../credentials/' + releaseProps['storeFile'])
                storePassword releaseProps['storePassword']
                keyAlias releaseProps['keyAlias']
                keyPassword releaseProps['keyPassword']
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (c) => {
    let gradle = c.modResults.contents;
    if (gradle.includes('releasePropsFile')) return c;

    const signingConfigs = gradle.match(/signingConfigs \{\n(\s+)debug \{[\s\S]*?\n\1\}/);
    if (!signingConfigs) throw new Error('with-release-signing: signingConfigs { debug { ... } } not found in app/build.gradle');
    gradle = gradle.replace(signingConfigs[0], signingConfigs[0] + RELEASE_CONFIG);

    const releaseUsesDebug = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseUsesDebug.test(gradle)) throw new Error('with-release-signing: the release build type signing line was not found');
    gradle = gradle.replace(
      releaseUsesDebug,
      `$1signingConfig ${PROPS}.exists() ? signingConfigs.release : signingConfigs.debug`,
    );

    c.modResults.contents = gradle;
    return c;
  });
};
