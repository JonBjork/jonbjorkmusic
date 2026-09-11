// Initial local build. WORKOUTS_DEPENDENCY_ROOT can reuse an existing installation.
const path=require('path');
const fs=require('fs');
const {createRequire}=require('module');
const dependencies=process.env.WORKOUTS_DEPENDENCY_ROOT || __dirname;
const requireDependency=createRequire(path.join(dependencies,'package.json'));
const webpack=requireDependency('webpack');
const output=path.join(__dirname,'dist');
const packageRoot=path.resolve(__dirname,'../../packages/workouts');
process.env.NODE_ENV='development';
webpack({mode:'development',devtool:false,parallelism:1,entry:path.join(__dirname,'src/main.jsx'),output:{path:output,filename:'bundle.js'},resolve:{extensions:['.js','.jsx'],modules:[path.join(dependencies,'node_modules'),'node_modules']},module:{rules:[
 {test:/\.jsx?$/,exclude:/node_modules/,use:{loader:requireDependency.resolve('babel-loader'),options:{presets:[requireDependency.resolve('@babel/preset-env'),requireDependency.resolve('@babel/preset-react')]}}},
 {test:/\.css$/,use:[requireDependency.resolve('style-loader'),requireDependency.resolve('css-loader')]}
]},optimization:{minimize:false}},(error,stats)=>{
 if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return;}
 fs.copyFileSync(path.join(__dirname,'index.html'),path.join(output,'index.html'));
 for(const [source,target] of [['audio','audio'],['covers','workouts'],['metronome-sounds','metronome-sounds']])fs.cpSync(path.join(packageRoot,source),path.join(output,target),{recursive:true});
 console.log('Standalone workout preview built.');
});
