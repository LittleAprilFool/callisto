cd ./extensions

for i in *.js;
do 
jupyter nbextension disable ${i%.*};
jupyter nbextension uninstall ${i};
done