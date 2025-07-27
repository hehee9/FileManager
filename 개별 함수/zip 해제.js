const File = java.io.File;
const FileInputStream = java.io.FileInputStream;
const FileOutputStream = java.io.FileOutputStream;
const ZipInputStream = java.util.zip.ZipInputStream;

/**
 * @description ZIP 파일 압축 해제
 * @param {string} zipFilePath 압축 해제할 ZIP 파일의 경로
 * @returns {string|null} 성공 시 압축 해제된 폴더 경로 | null
 */
function unzip(zipFilePath) {
    let zipFile = new File(zipFilePath);

    if (!zipFile.exists() || zipFile.isDirectory()) {
        Log.e(`${zipFilePath} is not a file or directory`);
        return null;
    }

    let fileName = zipFile.getName();
    let destDirName = fileName.lastIndexOf('.') > 0 ?
        fileName.substring(0, fileName.lastIndexOf('.')) :
        fileName;
    let destDirectory = new File(zipFile.getParent(), destDirName);

    let destDirPath;
    try {
        destDirPath = destDirectory.getCanonicalPath();
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return null;
    }

    if (!destDirectory.exists()) {
        destDirectory.mkdirs();
    }

    // 압축 해제 로직
    let fis = null;
    let zis = null;
    try {
        fis = new FileInputStream(zipFile);
        zis = new ZipInputStream(fis);
        let zipEntry;

        while ((zipEntry = zis.getNextEntry()) != null) {
            let newFilePath = new File(destDirectory, zipEntry.getName()).getCanonicalPath();

            // Zip Slip 보안 취약점 방지
            if (!newFilePath.startsWith(destDirPath + File.separator)) {
                throw new java.io.IOException("잘못된 파일 경로입니다: " + zipEntry.getName());
            }

            let newFile = new File(newFilePath);

            if (zipEntry.isDirectory()) {
                if (!newFile.isDirectory() && !newFile.mkdirs()) {
                    throw new java.io.IOException("디렉터리 생성에 실패했습니다: " + newFile);
                }
            } else {
                let parent = newFile.getParentFile();
                if (!parent.isDirectory() && !parent.mkdirs()) {
                    throw new java.io.IOException("디렉터리 생성에 실패했습니다: " + parent);
                }

                let fos = new FileOutputStream(newFile);
                let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 4096);
                let len;
                while ((len = zis.read(buffer)) > 0) {
                    fos.write(buffer, 0, len);
                }
                fos.close();
            }
            zis.closeEntry();
        }
      
        return destDirectory.getAbsolutePath();

    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return null;

    } finally {
        // 리소스 정리
        try {
            if (zis != null) zis.close();
            if (fis != null) fis.close();
        } catch (e) {
            Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        }
    }
}