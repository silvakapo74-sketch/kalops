// Generate a real entry file for each product URL so direct links also work
// on simple static hosting. Netlify's _redirects handles unknown SPA routes.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {products} from '../src/products.js';

const shell=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const dist=resolve(new URL('../dist',import.meta.url).pathname);
for(const product of products){
  const directory=resolve(dist,'.'+product.path);
  await mkdir(directory,{recursive:true});
  const html=shell.replace(/<title>.*?<\/title>/, '<title>'+product.name+' '+product.size+' no atacado | Kalops</title>');
  await writeFile(resolve(directory,'index.html'),html);
}
console.log('Created '+products.length+' product page entrypoints.');
