/** 画面に出す版（例：「版 a3d2796（2026-11-12 23:40）」）。新しい版に切り替わったかを確かめるのに使う */
export const APP_VERSION = __APP_VERSION__;
export const BUILT_AT = __BUILT_AT__;
export const versionLabel = () => `版 ${APP_VERSION}（${BUILT_AT}）`;
