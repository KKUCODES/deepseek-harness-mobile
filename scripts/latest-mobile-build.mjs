import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { latestTurnProcessSources } from './latest-turn-process-sources.mjs';

/** Node 会向父目录寻找依赖；候选 SDK 不得因此借用日常项目的旧版包。 */
export function selectSdkPackage(name, candidates, version) {
  for (const { root, require: candidateRequire } of candidates) {
    let metadataPath;
    try { metadataPath = realpathSync(candidateRequire.resolve(`${name}/package.json`)); }
    catch (error) { if (error.code === 'MODULE_NOT_FOUND') continue; throw error; }
    const path = relative(realpathSync(root), metadataPath);
    if (isAbsolute(path) || path === '..' || path.startsWith('../') || path.startsWith('..\\')) continue;
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    if (name.startsWith('@deepseek-ai/dsh-') && metadata.version !== version) {
      throw Error(`Mixed mobile SDK: ${name}@${metadata.version}`);
    }
    return { require: candidateRequire, metadata };
  }
  throw Error(`Package missing from isolated mobile SDK: ${name}`);
}

/** 只供固定版本候选构建；普通构建和日常 App 不受影响。 */
export function latestMobileBuild(root, { officialOnly = false, officialVersion = '0.2.1-alpha.1', ci = false } = {}) {
  if (!['0.2.1-alpha.1', '0.2.1-alpha.2', '0.2.1-rc.2'].includes(officialVersion)) throw Error('Unreviewed mobile SDK');
  const rc21 = officialVersion === '0.2.1-rc.2';
  const modernPlatform = officialVersion !== '0.2.1-alpha.1';
  if (modernPlatform && !officialOnly) throw Error('Modern SDK requires the official candidate');
  if (ci && (!rc21 || !officialOnly)) throw Error('CI requires the reviewed official rc.2 candidate');
  const upstream = ci ? resolve(root, 'artifacts/ci/official-source-rc21') : rc21 ? resolve(root, 'artifacts/rc21/source') : resolve(root, 'artifacts', modernPlatform ? 'official-alpha2-source' : 'latest-mobile-source');
  const runtime = ci ? resolve(root, 'artifacts/ci/sdk/rc21') : rc21 ? resolve(root, '../plugin/artifacts/ci/sdk/rc21') : resolve(root, 'artifacts', modernPlatform ? 'official-alpha2-mobile-runtime' : officialOnly ? 'official-mobile-runtime' : 'latest-mobile-runtime');
  const official = rc21 ? runtime : resolve(root, '../plugin/artifacts', modernPlatform ? 'official-dsh-alpha2' : officialOnly ? 'official-dsh-plugin-only' : 'latest-runtime-check');
  const localRequire = createRequire(resolve(runtime, 'package.json'));
  const officialRequire = createRequire(resolve(official, modernPlatform ? 'node_modules/@deepseek-ai/dsh/package.json' : 'package.json'));
  const pluginSdk = ci ? resolve(root, 'artifacts/ci/sdk/host') : resolve(root, '../plugin/artifacts/official-alpha2-sdk');
  const candidates = rc21 ? [{ root: runtime, require: localRequire }] : modernPlatform ? [
    { root: runtime, require: localRequire },
    { root: pluginSdk, require: createRequire(resolve(pluginSdk, 'package.json')) },
    ...(!ci ? [{ root: official, require: officialRequire }] : []),
  ] : [];
  const versions = {};
  const packageRequire = name => {
    if (modernPlatform) {
      const selected = selectSdkPackage(name, candidates, officialVersion);
      versions[name] = selected.metadata.version;
      return selected.require;
    }
    const metadataPath = (() => { try { return localRequire.resolve(`${name}/package.json`); } catch { return officialRequire.resolve(`${name}/package.json`); } })();
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    if (name.startsWith('@deepseek-ai/dsh-') && metadata.version !== officialVersion) throw Error(`Mixed mobile SDK: ${name}@${metadata.version}`);
    versions[name] = metadata.version;
    return metadataPath.startsWith(runtime) ? localRequire : officialRequire;
  };
  const sdk = specifier => packageRequire(specifier.split('/').slice(0, 2).join('/')).resolve(specifier);
  const alias = { '@upstream': resolve(upstream, 'packages/client') };
  for (const name of ['@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives']) alias[name] = sdk(name);
  alias['@deepseek-ai/dsh-util-values'] = resolve(upstream, 'packages/util/values/src/index.ts');
  alias['@deepseek-ai/dsh-file-reference/grammar'] = resolve(upstream, 'packages/context/file-reference/src/grammar.ts');
  const generated = ci ? resolve(root, 'artifacts/ci/generated') : rc21 ? resolve(root, 'artifacts/rc21/generated') : resolve(root, 'artifacts', modernPlatform ? 'official-alpha2-mobile-generated' : 'latest-mobile-generated');
  mkdirSync(generated, { recursive: true });
  const icons = resolve(upstream, 'packages/client/ui-primitives/src/icons/index.tsx');
  const oldIconNames = ['IconBranchOutline16', 'IconCheckOutline16', 'IconChevronDownOutline14', 'IconChevronLeftOutline14',
    'IconChevronRightOutline14', 'IconCloseOutline16', 'IconCopyOutline16', 'IconCordisPluginOutline14', 'IconDataOutline16',
    'IconEllipsisOutline16', 'IconFolderClose16', 'IconNewChatOutline16', 'IconPanelLeftOutline16', 'IconPaperclipOutline16',
    'IconPersonalizationOutline16', 'IconPlusOutline16', 'IconRefreshOutline16', 'IconSearchOutline16', 'IconSendOutline14',
    'IconSettingsOutline16', 'IconThinkOutline14'];
  const iconNames = { IconBrowseOutline16: 'IconGlobeOutlineRegular', ...Object.fromEntries(oldIconNames.map(name => [name, name.replace(/\d+$/, 'Regular')])) };
  const iconSource = readFileSync(icons, 'utf8');
  for (const name of Object.values(iconNames)) if (!iconSource.includes(`export const ${name} `)) throw Error(`Latest mobile artwork requires review: ${name}`);
  const iconAliases = resolve(generated, 'icons.mjs');
  writeFileSync(iconAliases, `export { ${Object.entries(iconNames).map(([oldName, newName]) => `${newName} as ${oldName}`).join(', ')} } from ${JSON.stringify(icons.replaceAll('\\', '/'))};\n`);
  const resolver = {
    name: 'verified-latest-mobile-sdk',
    setup(builder) {
      latestTurnProcessSources(upstream).setup(builder);
      builder.onResolve({ filter: /ui-primitives[\\/]src[\\/]icons[\\/]index\.tsx$/ }, args => {
        if (args.importer.replaceAll('\\', '/').startsWith(resolve(root, 'src').replaceAll('\\', '/') + '/')) return { path: iconAliases };
      });
      builder.onResolve({ filter: /deepseek-harness[\\/]/ }, args => {
        const path = resolve(args.resolveDir, args.path).replaceAll('\\', '/');
        const relative = path.split('/deepseek-harness/')[1];
        if (!relative) return;
        const target = resolve(upstream, relative);
        if (!existsSync(target)) throw Error(`Latest source moved or removed: ${relative}`);
        return { path: target };
      });
      builder.onResolve({ filter: /^@deepseek-ai\// }, args => {
        const parts = args.path.split('/'), name = parts.slice(0, 2).join('/');
        const required = packageRequire(name);
        const metadata = JSON.parse(readFileSync(required.resolve(`${name}/package.json`), 'utf8'));
        versions[name] = metadata.version;
        // 发布的 /client 是 ModuleLoader 注册包，没有 ESM 导出；静态借用必须指向原客户端源码。
        if (args.path.endsWith('/client') && metadata.repository?.directory) {
          const paths = ['src/client/index.ts', 'src/client.ts'].map(path => resolve(upstream, metadata.repository.directory, path));
          const path = paths.find(existsSync);
          if (path) return { path };
          if (metadata.exports?.['./client']?.default === './lib/client.js') throw Error(`Latest client source missing: ${name}`);
        }
        return { path: required.resolve(args.path) };
      });
    },
  };
  return { upstream, version: officialVersion, generated, nativeNavigation: true,
    dist: ci ? resolve(root, 'artifacts/ci/web') : resolve(root, 'artifacts', rc21 ? 'official-rc21-mobile-dist' : modernPlatform ? 'official-alpha2-mobile-dist' : officialOnly ? 'official-mobile-dist' : 'latest-mobile-dist'),
    alias, resolver, sdk, versions, runtime, officialOnly };
}
