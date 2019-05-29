cd ./extensions

jupyter nbextension install . --user;

for i in *.js;
do
jupyter nbextension enable ${i%.*};
done