/**
 * @description 파일 생성
 * @param {string} path 파일 경로
 * @param {string} [data] 파일 내용
 * @returns {string|null} 파일 내용 | null
 */
function write(path, data) {
    if (!path || typeof path !== "string") return null;
    if (data === undefined) data = "";
    
    try{
        return FileStream.write(path, data);
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return null;
    }
}

/**
 * @description 파일 읽기
 * @param {string} path 파일 경로
 * @returns {string|null} 파일 내용 | null
 */
function read(path) {
    if (!path || typeof path !== "string") return null;
    return FileStream.read(path);
}

/**
 * @description 파일 삭제
 * @param {string} path 파일 경로
 * @returns {boolean} 성공 여부
 */
function remove(path) {
    if (!path || typeof path !== "string") return false;
    try {
        return FileStream.remove(path);
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return false;
    }
}

/**
 * @description 파일 추가
 * @param {string} path 파일 경로
 * @param {string} [data] 추가할 내용
 * @returns {string|null} 전체 파일 내용 | null
 */
function append(path, data) {
    if (!path || typeof path !== "string") return null;
    if (data === undefined) data = "";
    try {
        return FileStream.append(path, data);
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return null;
    }
}