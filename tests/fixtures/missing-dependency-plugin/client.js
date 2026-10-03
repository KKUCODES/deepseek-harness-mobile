window.__ModuleLoader__.load({ id: '@dsh-mobile/missing-dependency-verification', factory() {
  return { inject: ['dshmVerificationMissingService'], apply() {
    throw new Error('Missing service must prevent plugin activation');
  } };
} });
