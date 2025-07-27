const File = java.io.File;
const FileInputStream = java.io.FileInputStream;
const FileOutputStream = java.io.FileOutputStream;
const ZipOutputStream = java.util.zip.ZipOutputStream;
const ZipEntry = java.util.zip.ZipEntry;

/**
 * @description 폴더를 ZIP 파일로 압축
 * @param {string} sourceFolderPath 압축할 폴더 경로
 * @param {string} [zipFilePath] 압축 파일 경로
 * @returns {string|null} 성공 시 압축 파일 경로 | null
 */
function zipFolder(sourceFolderPath, zipFilePath) {
    if (!zipFilePath) {
        try {
            let sourceFileForPath = new File(sourceFolderPath);
            let parentDir = sourceFileForPath.getParent();
            let folderName = sourceFileForPath.getName();

            if (parentDir) {
                zipFilePath = parentDir + "/" + folderName + ".zip";
            } else {
                zipFilePath = folderName + ".zip";
            }
        } catch (e) {
            Log.e(`${e.name}\n${e.message}\n${e.stack}`);
            return null;
        }
    }

    let fos = null;
    let zos = null;
    try {
        // 소스 경로 검증
        let sourceFile = new File(sourceFolderPath);
        if (!sourceFile.exists() || !sourceFile.isDirectory()) {
            Log.e("소스 경로가 존재하지 않거나 폴더가 아닙니다.\n시도한 경로: " + sourceFolderPath);
            return null;
        }


        fos = new FileOutputStream(zipFilePath);
        zos = new ZipOutputStream(fos);

        _addFolderToZip(sourceFile, sourceFile.getName(), zos);

        return zipFilePath;

    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return null;
    } finally {
        try {
            if (zos !== null) zos.close();
            if (fos !== null) fos.close();

        } catch (e) {
            Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        }
    }
}

/**
 * @description 폴더를 ZIP 파일로 압축
 * @param {File} fileOrFolder 압축할 파일 또는 폴더
 * @param {string} parentPathInZip 파일 또는 폴더의 상위 경로
 * @param {ZipOutputStream} zos ZIP 출력 스트림
 */
function _addFolderToZip(fileOrFolder, parentPathInZip, zos) {
    try {
        // 폴더인 경우
        if (fileOrFolder.isDirectory()) {
            let children = fileOrFolder.listFiles();
            if (children === null) return;

            for (let i = 0; i < children.length; i++) {
                let child = children[i];
                _addFolderToZip(child, parentPathInZip + "/" + child.getName(), zos);
            }
            return;
        }

        // 파일인 경우
        let fis = null;
        try {
            fis = new FileInputStream(fileOrFolder);

            let zipEntry = new ZipEntry(parentPathInZip);
            zos.putNextEntry(zipEntry);

            let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 1024);
            let len;
            while ((len = fis.read(buffer)) > 0) {
                zos.write(buffer, 0, len);
            }
        } finally {
            if (fis !== null) fis.close();
            zos.closeEntry();
        }
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
    }
}