const path=require('path');const {createRequire}=require('module');
const dep=process.env.WORKOUTS_DEPENDENCY_ROOT||__dirname,req=createRequire(path.join(dep,'package.json'));
const config={rootDir:path.resolve(__dirname,'../..'),testMatch:['<rootDir>/apps/workouts/tests/*.test.jsx'],testEnvironment:req.resolve('jest-environment-jsdom'),moduleDirectories:[path.join(dep,'node_modules'),'node_modules'],moduleNameMapper:{'\\.css$':'<rootDir>/apps/workouts/tests/style.cjs'},transform:{'^.+\\.[jt]sx?$':[req.resolve('babel-jest'),{presets:[req.resolve('@babel/preset-env'),req.resolve('@babel/preset-react')]}]}};
req('jest').run(['--runInBand','--config',JSON.stringify(config)]);
