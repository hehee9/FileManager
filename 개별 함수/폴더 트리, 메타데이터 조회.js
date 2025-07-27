/**
 * @description 폴더 구조 조회
 * @param {string} path 탐색할 폴더의 경로
 * @param {object} [options] 조회 옵션
 * @param {boolean} [options.detail=false] 파일 상세 정보(크기, 수정일) 표시 여부
 * @param {object} [options.search] 검색 조건
 * @param {string} [options.search.name] 파일명에 포함되어야 할 문자열
 * @param {string} [options.search.regex] 파일명에 포함되어야 할 정규식
 * @param {string} [options.search.extension] 필터링할 확장자 (점 제외, 예: 'png', 'txt')
 * @param {string} [options.search.content] 파일 내용에 포함되어야 할 문자열
 * @param {string} [options.search.contentRegex] 파일 내용에 적용할 정규식
 * @param {object} [options.sort] 정렬 조건
 * @param {'name'|'date'|'size'} [options.sort.by='name'] 정렬 기준 ('name', 'date', 'size')
 * @param {'asc'|'desc'} [options.sort.order='asc'] 정렬 순서 ('asc', 'desc')
 * @returns {string|null} 폴더 구조 문자열 | null
 */
function getDirectoryTree(path, options) {
    try {
        let opts = options || {};
        opts.detail = opts.detail || false;
        opts.search = opts.search || {};
        opts.sort = opts.sort || {};
        opts.sort.by = opts.sort.by || 'name';
        opts.sort.order = opts.sort.order || 'asc';

        const BINARY_EXTENSIONS = [
            'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp', // 이미지
            'mp3', 'wav', 'ogg', 'flac', 'aac', // 오디오
            'mp4', 'avi', 'mkv', 'mov', 'wmv', // 비디오
            'zip', 'rar', '7z', 'tar', 'gz', // 압축 파일
            'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'hwp', // 문서
            'exe', 'apk', 'dmg', 'iso', // 실행/이미지 파일
            'db', 'sqlite', 'sqlite3' // 데이터베이스
        ];

        let fileNameRegex = null;
        if (opts.search.regex) {
            try {
                fileNameRegex = new RegExp(opts.search.regex);
            } catch (e) {
                Log.e(`${e.name}\n${e.message}\n${e.stack}`);
                return "잘못되었거나 지원하지 않는 정규식 패턴";
            }
        }

        let contentRegex = null;
        if (opts.search.contentRegex) {
            try {
                contentRegex = new RegExp(opts.search.contentRegex);
            } catch (e) {
                Log.e(`${e.name}\n${e.message}\n${e.stack}`);
                return "잘못되었거나 지원하지 않는 정규식 패턴";
            }
        }

        const file = new java.io.File(path);
        if (!file.exists() || !file.isDirectory()) return null;
    
        const resultLines = [file.getName() + '/'];
        const hasContentSearch = !!(opts.search.content || opts.search.contentRegex);
    
        /**
         * @description 폴더 재귀 탐색
         * @param {java.io.File} directory 탐색할 디렉토리의 File 객체
         * @param {number} depth 현재 탐색 깊이 (들여쓰기에 사용)
         */
        const traverse = (directory, depth) => {
            let items = directory.listFiles();
            if (items === null) return;

            let itemList = Array.from(items);

            let filteredList = itemList.filter(item => {
                // 폴더는 항상 포함
                if (item.isDirectory()) return true;

                // 이름, 확장자
                const itemName = item.getName();
                const itemNameLower = itemName.toLowerCase();
                const extension = itemNameLower.split('.').pop();

                if (opts.search.extension && extension !== opts.search.extension.toLowerCase()) return false;
                if (opts.search.name && !itemNameLower.includes(opts.search.name.toLowerCase())) return false;
                if (fileNameRegex && !fileNameRegex.test(itemName)) return false;

                // 내용
                if (!hasContentSearch) return true;
                if (BINARY_EXTENSIONS.includes(extension)) return false;

                let content = FileStream.read(item.getAbsolutePath());
                if (content === null) return false;

                if (contentRegex) return contentRegex.test(content);
                if (opts.search.content) return content.includes(opts.search.content);

                return false;
            });

            // 목록 정렬
            filteredList.sort((a, b) => {
                // 폴더가 파일보다 항상 먼저 오도록
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;

                let compareResult = 0;
                switch (opts.sort.by) {
                    case 'date':
                        compareResult = a.lastModified() - b.lastModified();
                        break;
                    case 'size':
                        if (a.isFile() && b.isFile()) {
                            compareResult = a.length() - b.length();
                        }
                        break;
                    case 'name':
                    default:
                        compareResult = a.getName().compareTo(b.getName());
                        break;
                }
                return opts.sort.order === 'desc' ? -compareResult : compareResult;
            });

            // 결과 문자열 생성
            for (let i = 0; i < filteredList.length; i++) {
                let item = filteredList[i];
                let prefix = '    '.repeat(depth - 1) + (i === filteredList.length - 1 ? '└ ' : '├ ');

                if (item.isDirectory()) {
                    resultLines.push(prefix + item.getName() + '/');
                    traverse(item, depth + 1);
                } else {
                    let fileName = prefix + item.getName();
                    if (opts.detail) {
                        let metadata = getFileMetadata(item.getAbsolutePath());
                        fileName += ` (${metadata.readableSize} / ${metadata.readableLastModified})`;
                    }
                    resultLines.push(fileName);
                }
            }
        };
    
        traverse(file, 1);
    
        return resultLines.join('\n');
  
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return null;
    }
};


/**
 * @description 바이트 단위 변환
 * @param {number} bytes 바이트
 * @param {number} [decimals=2] 소수점 자릿수
 * @returns {string} 변환된 바이트 단위
 */
function formatBytes(bytes, decimals) {
    if (bytes === 0) return '0 Bytes';
    decimals = decimals || 2;

    let k = 1024;
    let dm = decimals < 0 ? 0 : decimals;
    let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * @description 파일 메타데이터 조회
 * @param {string} path 조회할 파일의 전체 경로
 * @returns {object|null} 메타데이터 객체 | null
 */
function getFileMetadata(path) {
    try {
        let file = new java.io.File(path);

        if (!file.exists()) return null;

        let size = file.length(); // 파일 크기 (bytes)
        let lastModified = file.lastModified(); // 마지막 수정 시간 (timestamp)

        return {
            name: String(file.getName()),
            path: String(file.getAbsolutePath()),
            size: size,
            lastModified: lastModified,
            isDirectory: file.isDirectory(),
            readableSize: formatBytes(size),
            readableLastModified: new Date(lastModified + 32_400_000).toISOString().replace('T', ' ').slice(0, 16)
        };
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return null;
    }
}