/**
 * @description 폴더 생성
 * @param {string} path 생성할 폴더 경로
 * @returns {boolean} 성공 여부
 */
function createDirectory(path) {
    try {
        let file = new java.io.File(path);

        if (file.exists()) return true;
        return file.mkdirs();

    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return false;
    }
}