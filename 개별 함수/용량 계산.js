/**
 * @description 파일 또는 폴더 크기 계산
 * @param {string} path 파일 또는 폴더 경로
 * @param {string} [unit="mb"] 단위 (kb, mb, gb)
 * @returns {number|null} 파일 또는 폴더 크기 | null
 */
function getStorageSize(path, unit) {
    const targetUnit = unit || "mb";

    try {
        let file = new java.io.File(path);
        if (!file.exists()) return null;
    
        let sizeInBytes;
    
        // 크기 계산
        if (file.isFile()) sizeInBytes = file.length();
        else if (file.isDirectory()) sizeInBytes = _getFolderSizeRecursive(file);
        else return null;
    
        // 단위 변환
        return _convertSize(sizeInBytes, targetUnit);
  
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return null;
    }
}

/**
 * @description 폴더 크기 계산
 * @param {File} folder 폴더
 * @returns {number} 폴더 크기
 */
function _getFolderSizeRecursive(folder) {
    let length = 0;
    let files = folder.listFiles();
  
    // 목록을 가져올 수 없는 경우
    if (files === null) return 0;
  
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        if (file.isFile()) length += file.length();
        else length += _getFolderSizeRecursive(file);
    }
    return length;
}


/**
 * @description 크기 변환
 * @param {number} bytes 바이트
 * @param {string} unit 단위 (b, kb, gb, tb, mb)
 * @returns {number} 변환된 크기
 */
function _convertSize(bytes, unit) {
    const KILO = 1024;
    let size;
  
    switch (unit.toLowerCase()) {
        case "b":
            size = bytes;
            break;
        case "kb":
            size = bytes / KILO;
            break;
        case "gb":
            size = bytes / KILO / KILO / KILO;
            break;
        case "tb":
            size = bytes / KILO / KILO / KILO / KILO;
            break;
        case "mb":
        default:
            size = bytes / KILO / KILO;
            break;
    }
    return Number(size.toFixed(2));
}