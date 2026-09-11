let base='';
export function configureAssets(url=''){base=url.replace(/\/$/,'');}
export function assetUrl(path){return `${base}/${path.replace(/^\//,'')}`;}
