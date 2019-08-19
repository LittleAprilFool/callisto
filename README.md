# Jupyter-Sharing

This is a Jupyter notebook extension for data scientists to better collaborate when creating computational narratives, such that new coming data scientists can better understand not only a computational narrative at its current state but also past discussions and decisions lead to it.


## Get the Plugin Working

1. Clone the [extension repo](https://github.com/educational-technology-collective/jupyter-sharing-extension.git)
2. Install npm packages ```npm install```
3. Run the extensions by ``` npm run watch ```; all the changes on the extension code will be hot-loaded 
4. Run MongoDB on ```mongodb://localhost:27017/test```
5. Clone the [server repo](https://github.com/educational-technology-collective/jupyter-sharing-server.git)
6. Install npm packages in the server repo by ```npm install```
7. Run the server on port 5555 by ```npm run watch```; all the changes on the server code will be hot-loaded
8. Run ```jupyter notebook```

## System Architecture

[!System Architecture](doc/system_diagram.png)