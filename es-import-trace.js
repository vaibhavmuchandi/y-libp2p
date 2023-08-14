export const load = async (url, context, defaultLoad) => {
    // console.log('import: ' + url);
    if (url.includes("yjs")) console.log("YJS Imported")
    return await defaultLoad(url, context);
};