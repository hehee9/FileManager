/**
 * @module FileManager
 * @description 기존 유틸리티 스크립트를 기반으로 한 파일 및 디렉토리 작업을 통합한 클래스
 * 
 * @author hehee
 * @license CC BY-NC-SA 4.0
 * 
 * @property {function} FileManager 클래스
 * @property {function} createDirectory 폴더 생성
 * @property {function} deleteDirectory 폴더 삭제
 * @property {function} getDirectoryTree 폴더 구조 조회
 * @property {function} getMetadata 파일 메타데이터 조회
 * @property {function} write 파일 생성
 * @property {function} read 파일 읽기
 * @property {function} append 파일 끝부분에 내용 추가
 * @property {function} delete 파일 삭제
 * @property {function} move 파일 이동
 * @property {function} copy 파일 복사
 * @property {function} unzip ZIP 파일 압축 해제
 * @property {function} getStorageSize 파일 또는 폴더 크기 계산
 * @property {function} remove 파일 또는 폴더 삭제
 */
(function() {
    const File = java.io.File;
    const FileInputStream = java.io.FileInputStream;
    const FileOutputStream = java.io.FileOutputStream;
    const ZipInputStream = java.util.zip.ZipInputStream;
    const ZipOutputStream = java.util.zip.ZipOutputStream;
    const ZipEntry = java.util.zip.ZipEntry;
    const newInstance = java.lang.reflect.Array.newInstance;

    function FileManager() {}

    /* ============================= 헬퍼 및 유틸리티 ============================= */

    /**
     * @description 에러 로깅
     * @param {Error} e 예외 객체
     * @param {string} [customMessage] 추가적으로 표시할 메시지
     */
    FileManager.prototype._handleError = function(e, customMessage) {
        let errorMessage = customMessage ? customMessage + '\n' : '';
        errorMessage += `${e.name}\n${e.message}\n${e.stack}`;
        Log.e(errorMessage);
    };

    /**
     * @description 스트림 복사
     * @param {java.io.InputStream} sourceStream 소스 스트림
     * @param {java.io.OutputStream} destStream 대상 스트림
     */
    FileManager.prototype._copyStream = function(sourceStream, destStream) {
        let buffer = newInstance(java.lang.Byte.TYPE, 4096);
        let bytesRead;
        while ((bytesRead = sourceStream.read(buffer)) !== -1) {
            destStream.write(buffer, 0, bytesRead);
        }
    };

    /**
     * @description 파일 복사 (내부 헬퍼)
     * @param {java.io.File} sourceFile 원본 파일 객체
     * @param {java.io.File} destFile 대상 파일 객체
     */
    FileManager.prototype._copyFile = function(sourceFile, destFile) {
        let fis = null;
        let fos = null;
        try {
            fis = new FileInputStream(sourceFile);
            fos = new FileOutputStream(destFile);
            this._copyStream(fis, fos);
        } finally {
            if (fis) fis.close();
            if (fos) fos.close();
        }
};

    /**
     * @description 크기 변환
     * @param {number} bytes 바이트
     * @param {string} unit 단위 (b, kb, gb, tb, mb)
     * @returns {number} 변환된 크기
     */
    FileManager.prototype._convertSize = function(bytes, unit) {
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
    };

    /**
     * @description 디렉토리 순회
     * @param {string} path 순회할 디렉토리 경로
     * @param {object} options 옵션
     * @param {object} [options.initialContext] 초기 컨텍스트
     * @param {function} [options.onFile] 파일 처리 함수
     * @param {function} [options.onDir] 디렉토리 처리 함수
     * @param {string} [options.order='pre-order'] 순회 순서 ('pre-order', 'post-order')
     * @returns {object} 컨텍스트
     */
    FileManager.prototype._traverseDirectory = function(path, options) {
        const rootFile = new File(path);
        if (!rootFile.exists()) {
            return options.initialContext || {};
        }

        const context = options.initialContext || {};
        const onFile = options.onFile || function() {};
        const onDir = options.onDir || function() {};
        const order = options.order || 'pre-order';

        const walk = (currentFile) => {
            // 디렉토리 처리 (pre-order)
            if (currentFile.isDirectory() && order === 'pre-order') {
                onDir(currentFile, context);
            }

            // 자식 순회
            if (currentFile.isDirectory()) {
                const children = currentFile.listFiles();
                if (children !== null) {
                    for (let i = 0; i < children.length; i++) {
                        walk(children[i]);
                    }
                }
            }

            // 파일 처리
            if (currentFile.isFile()) {
                onFile(currentFile, context);
            }

            // 디렉토리 처리 (post-order)
            if (currentFile.isDirectory() && order === 'post-order') {
                onDir(currentFile, context);
            }
        };

        walk(rootFile);
        return context;
    };

    /** @description 파일명/경로 관련 유틸리티 함수 네임스페이스 */
    FileManager.prototype.utils = {
        /**
         * @description 경로에서 확장자를 제외한 파일 이름을 반환
         * @param {string} path 파일 경로 또는 이름
         * @returns {string} 확장자를 제외한 이름
         */
        getBaseName: function(path) {
            let fileName = new File(path).getName();
            let dotIndex = fileName.lastIndexOf('.');
            return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
        },

        /**
         * @description 경로에서 확장자를 소문자로 반환
         * @param {string} path 파일 경로 또는 이름
         * @returns {string} 소문자 확장자
         */
        getExtension: function(path) {
            let fileName = new File(path).getName();
            let dotIndex = fileName.lastIndexOf('.');
            return dotIndex > -1 ? fileName.substring(dotIndex + 1).toLowerCase() : '';
        }
    };

    /* ============================= 폴더 관련 ============================= */

    /**
     * @description 폴더 생성
     * @param {string} path 생성할 폴더 경로
     * @returns {boolean} 성공 여부
     */
    FileManager.prototype.createDirectory = function(path) {
        try {
            let file = new File(path);
            if (file.exists()) return true;
            return file.mkdirs();
        } catch (e) {
            this._handleError(e);
            return false;
        }
    };

    /**
     * @description 폴더 및 하위 파일 삭제
     * @param {string} path 삭제할 폴더의 경로
     * @returns {boolean} 성공 여부
     */
    FileManager.prototype.deleteDirectory = function(path) {
        try {
            const file = new File(path);
            if (!file.exists()) return true;
            if (!file.isDirectory()) return file.delete();

            const result = this._traverseDirectory(path, {
                onFile: (file, context) => {
                    if (!file.delete()) context.success = false;
                },
                onDir: (dir, context) => {
                    if (!dir.delete()) context.success = false;
                },
                initialContext: { success: true },
                order: 'post-order'
            });

            return result.success;
        } catch (e) {
            this._handleError(e);
            return false;
        }
    };

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
    FileManager.prototype.getDirectoryTree = function(path, options) {
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
                    this._handleError(e);
                    return "잘못되었거나 지원하지 않는 정규식 패턴";
                }
            }

            let contentRegex = null;
            if (opts.search.contentRegex) {
                try {
                    contentRegex = new RegExp(opts.search.contentRegex);
                } catch (e) {
                    this._handleError(e);
                    return "잘못되었거나 지원하지 않는 정규식 패턴";
                }
            }

            const file = new File(path);
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
                    const extension = this.utils.getExtension(itemName);

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
                            compareResult = a.getName().localeCompare(b.getName());
                            break;
                    }
                    return opts.sort.order === 'desc' ? -compareResult : compareResult;
                });

                // 결과 문자열 생성
                for (let i = 0; i < filteredList.length; i++) {
                    let item = filteredList[i];
                    let prefix = '\u2502  '.repeat(depth - 1) + (i === filteredList.length - 1 ? "\u2514 " : "\u251C "); // 문자가 깨지길래 유니코드로 표기

                    if (item.isDirectory()) {
                        resultLines.push(prefix + item.getName() + '/');
                        traverse(item, depth + 1);
                    } else {
                        let fileName = prefix + item.getName();
                        if (opts.detail) {
                            let metadata = this.getMetadata(item.getAbsolutePath());
                            fileName += ` (${metadata.readableSize} / ${metadata.readableLastModified})`;
                        }
                        resultLines.push(fileName);
                    }
                }
            };

            traverse(file, 1);
            return resultLines.join('\n');

        } catch (e) {
            this._handleError(e);
            return null;
        }
    };

    /**
     * @description 파일 메타데이터 조회
     * @param {string} path 조회할 파일의 전체 경로
     * @returns {object|null} 메타데이터 객체 | null
     */
    FileManager.prototype.getMetadata = function(path) {
        try {
            let file = new File(path);

            if (!file.exists()) return null;

            let size = file.length(); // 파일 크기 (bytes)
            let lastModified = file.lastModified(); // 마지막 수정 시간 (timestamp)

            return {
                name: String(file.getName()),
                path: String(file.getAbsolutePath()),
                size: size,
                lastModified: lastModified,
                isDirectory: file.isDirectory(),
                readableSize: this._convertSize(size, "mb") + " MB",
                readableLastModified: new Date(lastModified + 32_400_000).toISOString().replace('T', ' ').slice(0, 16)
            };
        } catch (e) {
            this._handleError(e);
            return null;
        }
    };

    /* ============================= 파일 관련 ============================= */

    /**
     * @description 파일 생성
     * @param {string} path 파일 경로 (폴더, 파일 자동 생성)
     * @param {string} [data] 파일 내용
     * @returns {string|null} 파일 내용 | null
     */
    FileManager.prototype.write = function(path, data) {
        if (!path || typeof path !== "string") return null;
        if (data === undefined) data = "";

        try{
            return FileStream.write(path, data);
        } catch (e) {
            this._handleError(e);
            return null;
        }
    };

    /**
     * @description 파일 읽기
     * @param {string} path 파일 경로
     * @returns {string|null} 파일 내용 | null
     */
    FileManager.prototype.read = function(path) {
        if (!path || typeof path !== "string") return null;
        return FileStream.read(path);
    }

    /**
     * @description 파일 끝부분에 내용 추가
     * @param {string} path 파일 경로
     * @param {string} [data] 추가할 내용
     * @returns {string|null} 전체 파일 내용 | null
     */
    FileManager.prototype.append = function(path, data) {
        if (!path || typeof path !== "string") return null;
        if (data === undefined) data = "";
        try {
            return FileStream.append(path, data);
        } catch (e) {
            this._handleError(e);
            return null;
        }
    };

    /**
     * @description 파일 삭제
     * @param {string} path 파일 경로
     * @returns {boolean} 성공 여부
     */
    FileManager.prototype.delete = function(path) {
        if (!path || typeof path !== "string") return false;
        try {
            return FileStream.remove(path);
        } catch (e) {
            this._handleError(e);
            return false;
        }
    };

    /* ============================= 이동, 복사 ============================= */

    /**
     * @description 파일 또는 폴더 이동
     * @param {string|string[]} sourcePath 이동할 파일 또는 폴더 경로 (배열)
     * @param {string} resultPath 이동 결과 경로
     * @returns {boolean} 성공 여부
     */
    FileManager.prototype.move = function(sourcePath, resultPath) {
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

        const copySuccess = this.copy(sourcePath, resultPath);

        if (!copySuccess) {
            Log.e("이동 실패: 복사 과정에서 오류가 발생했습니다.");
            return false;
        }

        try {
            let targets = Array.isArray(sourcePath) ? sourcePath : [sourcePath];

            for (let i = 0; i < targets.length; i++) {
                let path = targets[i];
                let source = new File(path);
                if (source.exists()) _deleteRecursively(source);
            }
            return true;
        } catch (e) {
            this._handleError(e);
            return false;
        }
    };

    /**
     * @description 파일 또는 폴더 복사
     * @param {string|string[]} sourcePath 복사할 파일 또는 폴더 경로 (배열)
     * @param {string} resultPath 복사 결과 경로
     * @returns {boolean} 성공 여부
     */
    FileManager.prototype.copy = function(sourcePath, resultPath) {
        if (!sourcePath || !resultPath || typeof resultPath !== "string") return false;

        try {
            const targets = Array.isArray(sourcePath) ? sourcePath : [sourcePath];
            const resultDir = new File(resultPath);

            if (!this.createDirectory(resultPath)) {
                Log.e(`복사 실패: 대상 폴더 '${resultPath}'를 생성할 수 없습니다.`);
                return false;
            }

            for (let i = 0; i < targets.length; i++) {
                let path = targets[i];
                let source = new File(path);

                if (!source.exists()) {
                    Log.e(`복사 실패: 원본 '${path}'를 찾을 수 없습니다.`);
                    continue;
                }

                let destination = new File(resultDir, source.getName());

                if (source.isFile()) {
                    this._copyFile(source, destination);
                } else if (source.isDirectory()) {
                    this._traverseDirectory(path, {
                        onDir: (dir, context) => {
                            let relativePath = context.sourceRoot.toURI().relativize(dir.toURI()).getPath();
                            let newDestDir = new File(context.resultRoot, relativePath);
                            if (!newDestDir.exists()) newDestDir.mkdirs();
                        },
                        onFile: (file, context) => {
                            let relativePath = context.sourceRoot.toURI().relativize(file.toURI()).getPath();
                            let newDestFile = new File(context.resultRoot, relativePath);
                            this._copyFile(file, newDestFile);
                        },
                        initialContext: {
                            sourceRoot: source,
                            resultRoot: destination
                        },
                        order: 'pre-order'
                    });
                }
            }
            return true;
        } catch (e) {
            this._handleError(e);
            return false;
        }
    };

    /* ============================= 압축 ============================= */

    /**
     * @description 파일/폴더를 ZIP 파일로 압축
     * @param {string} sourcePath 압축할 파일/폴더 경로
     * @param {string} [zipFilePath] 압축 파일 경로
     * @returns {string|null} 성공 시 압축 파일 경로 | null
     */
    FileManager.prototype.zip = function(sourcePath, zipFilePath) {
        // 결과 경로 설정
        if (!zipFilePath) {
            try {
                let sourceFileForPath = new File(sourcePath);
                let parentDir = sourceFileForPath.getParent();
                let baseName = this.utils.getBaseName(sourceFileForPath.getName());
                zipFilePath = parentDir ? `${parentDir}/${baseName}.zip` : `${baseName}.zip`;
            } catch (e) {
                this._handleError(e);
                return null;
            }
        }

        let fos = null;
        let zos = null;
        try {
            const sourceFile = new File(sourcePath);
            if (!sourceFile.exists()) {
                Log.e("소스 경로가 존재하지 않습니다.\n시도한 경로: " + sourcePath);
                return null;
            }

            fos = new FileOutputStream(zipFilePath);
            zos = new ZipOutputStream(fos);
            const _this = this;

            // 압축 파일 내에 루트 폴더 이름을 포함시키기 위해, 경로는 원본 폴더의 부모를 기준으로 생성
            if (sourceFile.isDirectory()) {
                const sourceParent = sourceFile.getParentFile();
                this._traverseDirectory(sourcePath, {
                    onDir: (dir, context) => {
                        const children = dir.listFiles();
                        if (children === null || children.length === 0) {
                            const entryName = context.sourceParent.toURI().relativize(dir.toURI()).getPath() + '/';
                            context.zos.putNextEntry(new ZipEntry(entryName));
                            context.zos.closeEntry();
                        }
                    },
                    onFile: (file, context) => {
                        const entryName = context.sourceParent.toURI().relativize(file.toURI()).getPath();
                        const zipEntry = new ZipEntry(entryName);
                        context.zos.putNextEntry(zipEntry);
                        let fis = new FileInputStream(file);
                        try {
                            _this._copyStream(fis, context.zos);
                        } finally {
                            fis.close();
                        }
                        context.zos.closeEntry();
                    },
                    initialContext: {
                        zos: zos,
                        sourceParent: sourceParent
                    },
                    order: 'pre-order'
                });
            }
            // 소스가 파일인 경우
            else {
                let fis = null;
                try {
                    fis = new FileInputStream(sourceFile);
                    let zipEntry = new ZipEntry(sourceFile.getName());
                    zos.putNextEntry(zipEntry);
                    _this._copyStream(fis, zos);
                } finally {
                    if (fis !== null) fis.close();
                    zos.closeEntry();
                }
            }

            return zipFilePath;

        } catch (e) {
            this._handleError(e);
            return null;
        } finally {
            try {
                if (zos !== null) zos.close();
                if (fos !== null) fos.close();

            } catch (e) {
                this._handleError(e);
            }
        }
    };

    /**
     * @description ZIP 파일 압축 해제
     * @param {string} zipFilePath 압축 해제할 ZIP 파일의 경로
     * @param {string} [resultFolderPath] 압축 해제 결과 폴더 경로
     * @returns {string|null} 성공 시 압축 해제된 폴더 경로 | null
     */
    FileManager.prototype.unzip = function(zipFilePath, resultFolderPath) {
        let zipFile = new File(zipFilePath);

        if (!zipFile.exists() || zipFile.isDirectory()) {
            Log.e(`${zipFilePath}은/는 파일이나 디렉토리가 아닙니다.`);
            return null;
        }

        let destDirectory;
        if (resultFolderPath) {
            destDirectory = new File(resultFolderPath);
        } else {
            let destDirName = this.utils.getBaseName(zipFile.getName());
            destDirectory = new File(zipFile.getParent(), destDirName);
        }

        let destDirPath;

        try {
            destDirPath = destDirectory.getCanonicalPath();
        } catch (e) {
            this._handleError(e);
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
                    let buffer = newInstance(java.lang.Byte.TYPE, 4096);
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
            this._handleError(e);
            return null;

        } finally {
            // 리소스 정리
            try {
                if (zis != null) zis.close();
                if (fis != null) fis.close();
            } catch (e) {
                this._handleError(e);
            }
        }
    };

    /* ============================= 용량 계산 ============================= */

    /**
     * @description 파일 또는 폴더 크기 계산
     * @param {string} path 파일 또는 폴더 경로
     * @param {string} [unit="mb"] 단위 (kb, mb, gb)
     * @returns {number|null} 파일 또는 폴더 크기 | null
     */
    FileManager.prototype.getStorageSize = function(path, unit) {
        const targetUnit = unit || "mb";

        try {
            const file = new File(path);
            if (!file.exists()) return null;

            if (file.isFile()) {
                return this._convertSize(file.length(), targetUnit);
            }

            const context = this._traverseDirectory(path, {
                onFile: (file, context) => {
                    context.totalSize += file.length();
                },
                initialContext: { totalSize: 0 }
            });

            return this._convertSize(context.totalSize, targetUnit);
        } catch (e) {
            this._handleError(e);
            return null;
        }
    };

    /**
     * @description 파일 또는 폴더 삭제
     * @param {string} path 삭제할 파일 또는 폴더 경로
     * @returns {boolean} 성공 여부
     */
    FileManager.prototype.remove = function(path) {
        if (!path || typeof path !== "string") return false;
        try {
            let file = new File(path);
            if (!file.exists()) return true;
            if (file.isDirectory()) return this.deleteDirectory(path);
            return file.delete();
        } catch (e) {
            this._handleError(e);
            return false;
        }
    };

    module.exports = FileManager;
})();