module.exports = [
"[turbopack-node]/transforms/postcss.ts?config=[project]/artifacts/zt-preview/postcss.config.mjs { CONFIG => \"[project]/artifacts/zt-preview/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "chunks/node_modules__pnpm_1a2z0184jm9gn._.js",
  "chunks/[root-of-the-server]__1p9wcq807qerc._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[turbopack-node]/transforms/postcss.ts?config=[project]/artifacts/zt-preview/postcss.config.mjs { CONFIG => \"[project]/artifacts/zt-preview/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript)");
    });
});
}),
];