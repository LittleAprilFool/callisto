export const getUserName = (): string => {
    if (window.location.href.split("/")[2].substring(0, 9) === "localhost") {
        return "localhost" + Math.floor(Math.random() * 100);
    }
    else if (window.location.href.split("/")[2].substring(0,3) === "127") {
        return "localhost" + Math.floor(Math.random() * 100);
    }
    else {
        return window.location.href.split("/")[4].split("_")[0];
    }
};