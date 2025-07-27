/**
 * @description 폴더 및 하위 파일 삭제
 * @param {string} path 삭제할 폴더의 경로
 * @returns {boolean} 성공 여부
 */
function deleteFolderRecursive(path) {
    try {
        let file = new java.io.File(path);
    
        if (!file.exists()) return true;
    
        if (file.isDirectory()) {
            let children = file.listFiles();
            for (let child of children) {
                if (!deleteFolderRecursive(child.getAbsolutePath())) {
                    return false;
                }
            }
        }
    
        return file.delete();
  
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return false;
    }
};