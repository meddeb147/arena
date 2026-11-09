/**
 * Feature flags.
 *
 * HARD RULE: real-money features do not exist in this codebase. `realMoney` is a
 * literal `false` type so nothing can enable it without a code change, which must
 * only happen after legal advice. A test asserts it stays false.
 */
export interface FeatureFlags {
  readonly realMoney: false;
  readonly rewardedAds: boolean;
  readonly bannerAds: boolean;
  readonly sponsorBanners: boolean;
  readonly battlePass: boolean;
  readonly weeklyPrizes: boolean;
}

export const DEFAULT_FEATURES: FeatureFlags = {
  realMoney: false,
  rewardedAds: false,
  bannerAds: false,
  sponsorBanners: false,
  battlePass: false,
  weeklyPrizes: false,
};
