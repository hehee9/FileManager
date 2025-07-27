const File = java.io.File;
const FileInputStream = java.io.FileInputStream;
const FileOutputStream = java.io.FileOutputStream;
      
/**
 * @description 파일 또는 폴더 복사
 * @param {string|string[]} targetPath 복사할 파일 또는 폴더 경로 (배열)
 * @param {string} resultPath 복사 결과 경로
 * @returns {boolean} 성공 여부
 */
function copy(targetPath, resultPath) {
    if (!targetPath || !resultPath || typeof resultPath !== "string") return false;

    try {
        /**
         * @description 파일 복사
         * @param {java.io.File} sourceFile 원본 파일 객체
         * @param {java.io.File} destFile 대상 파일 객체
         */
        const _copyFile = (sourceFile, destFile) => {
            let fis = null;
            let fos = null;
            try {
                fis = new FileInputStream(sourceFile);
                fos = new FileOutputStream(destFile);
                
                let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 4096);
                let bytesRead;
        
                while ((bytesRead = fis.read(buffer)) !== -1) {
                    fos.write(buffer, 0, bytesRead);
                }
            } finally {
                if (fis) fis.close();
                if (fos) fos.close();
            }
        };
    
        /**
         * @description 폴더 재귀 복사
         * @param {java.io.File} sourceDir 원본 폴더 객체
         * @param {java.io.File} destDir 대상 폴더 객체
         */
        const _copyDirectory = (sourceDir, destDir) => {
            if (!destDir.exists()) destDir.mkdirs();
        
            let children = sourceDir.listFiles();
            if (children === null) return; // 폴더가 비어있거나 접근 권한이 없는 경우
    
            for (let i = 0; i < children.length; i++) {
                let child = children[i];
                let destChild = new File(destDir, child.getName());
                if (child.isDirectory()) {
                    _copyDirectory(child, destChild);
                } else {
                    _copyFile(child, destChild);
                }
            }
        };


        // 메인 로직
        let targets = Array.isArray(targetPath) ? targetPath : [targetPath];
        let resultDir = new File(resultPath);

        if (!resultDir.exists()) resultDir.mkdirs();
    
        for (let i = 0; i < targets.length; i++) {
            let path = targets[i];
            let source = new File(path);
    
            if (!source.exists()) {
                Log.e(`복사 실패: 원본 '${path}'를 찾을 수 없습니다.`);
                return false;
            }
    
            let destination = new File(resultDir, source.getName());
    
            if (source.isDirectory()) {
                _copyDirectory(source, destination);
            } else {
                _copyFile(source, destination);
            }
        }
    
        return true;
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return false;
    }
}


/**
 * @description 파일 또는 폴더 이동
 * @param {string|string[]} targetPath 이동할 파일 또는 폴더 경로 (배열)
 * @param {string} resultPath 이동 결과 경로
 * @returns {boolean} 성공 여부
 */
function move(targetPath, resultPath) {
    /**
     * @description 파일 재귀 삭제
     * @param {java.io.File} fileToDelete 삭제할 파일 또는 폴더의 File 객체
     */
    const _deleteRecursively = (fileToDelete) => {
        if (fileToDelete.isDirectory()) {
            let children = fileToDelete.listFiles();
            if (children !== null) {
                for (let i = 0; i < children.length; i++) {
                    _deleteRecursively(children[i]);
                }
            }
        }
        fileToDelete.delete();
    };
  
    const copySuccess = copy(targetPath, resultPath);
  
    if (!copySuccess) {
        Log.e("이동 실패: 복사 과정에서 오류가 발생했습니다.");
        return false;
    }
  
    try {
        const File = java.io.File;
        let targets = Array.isArray(targetPath) ? targetPath : [targetPath];
    
        for (let i = 0; i < targets.length; i++) {
            let path = targets[i];
            let source = new File(path);
            if (source.exists()) _deleteRecursively(source);
        }
        return true;
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return false;
    }
}