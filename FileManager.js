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

    /**
     * @description 파일 관리자 클래스
     * @param {string} [basePath] 샌드박스 기본 경로
     */
    function FileManager(basePath) {
        this.basePath = null;
        this.isSandboxed = false;

        if (basePath && typeof basePath === 'string') {
            try {
                let baseDir = new File(basePath);
                if (!baseDir.exists()) {
                    baseDir.mkdirs();
                }
                this.basePath = baseDir.getAbsolutePath();
                this.isSandboxed = true;
            } catch (e) {
                this._handleError(e, "기본 경로 '" + basePath + "' 설정에 실패하여 샌드박스가 비활성화됩니다.");
                this.basePath = null;
                this.isSandboxed = false;
            }
        }
    }

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
     * @description 사용자 경로를 안전한 절대 경로로 변환
     * @param {string} userPath 입력 경로
     * @returns {java.io.File|null} 안전하게 검증된 File 객체 | null
     * @private
     */
    FileManager.prototype._resolvePath = function(userPath) {
        if (!this.isSandboxed) {
            return new File(String(userPath || ''));
        }
    
        let pathStr = String(userPath || '').trim();
        if (pathStr === '') {
            this._handleError(new Error("Invalid path input"), "경로가 비어있습니다.");
            return null;
        }

        try {
            let resolvedFile;
            let targetFile = new File(pathStr);

            if (targetFile.isAbsolute() || pathStr.startsWith('sdcard/')) {
                resolvedFile = targetFile;
            } else {
                resolvedFile = new File(this.basePath, pathStr);
            }

            const canonicalPath = resolvedFile.getCanonicalPath();
            const baseCanonicalPath = new File(this.basePath).getCanonicalPath();

            if (!canonicalPath.startsWith(baseCanonicalPath)) {
                this._handleError(new Error("Security Exception"), "허용된 작업 공간을 벗어난 경로입니다: " + pathStr);
                return null;
            }

            return resolvedFile;
        } catch (e) {
            this._handleError(e, "경로를 확인하는 중 오류가 발생했습니다: " + pathStr);
            return null;
        }
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
            return dotIndex > 0 ? String(fileName.substring(0, dotIndex)) : String(fileName);
        },

        /**
         * @description 경로에서 확장자를 소문자로 반환
         * @param {string} path 파일 경로 또는 이름
         * @returns {string} 소문자 확장자
         */
        getExtension: function(path) {
            let fileName = new File(path).getName();
            let dotIndex = fileName.lastIndexOf('.');
            return dotIndex > -1 ? String(fileName.substring(dotIndex + 1).toLowerCase()) : '';
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
            let file = this._resolvePath(path);
            if (!file) return false;
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
            const file = this._resolvePath(path);
            if (!file) return false;
            if (!file.exists()) return true;
            if (!file.isDirectory()) return file.delete();

            const result = this._traverseDirectory(file.getAbsolutePath(), {
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
     * @param {boolean} [options.showEmptyFolders=false] 내용이 없는 폴더 표시 여부
     * @param {object} [options.search] 검색 조건
     * @param {string} [options.search.name] 파일명에 포함되어야 할 문자열
     * @param {string} [options.search.regex] 파일명에 포함되어야 할 정규식
     * @param {string|string[]} [options.search.extension] 필터링할 확장자 (점 제외, 예: 'png', ['txt', 'pdf'])
     * @param {string} [options.search.content] 파일 내용에 포함되어야 할 문자열
     * @param {string} [options.search.contentRegex] 파일 내용에 적용할 정규식
     * @param {object} [options.sort] 정렬 조건
     * @param {'name'|'date'|'size'} [options.sort.by='name'] 정렬 기준 ('name', 'date', 'size')
     * @param {'asc'|'desc'} [options.sort.order='asc'] 정렬 순서 ('asc', 'desc')
     * @returns {string|null} 폴더 구조 문자열 | null
     */
    FileManager.prototype.getDirectoryTree = function(path, options) {
        try {
            const file = this._resolvePath(path);
            if (!file) return null;

            const self = this;
            let opts = options || {};
            opts.detail = opts.detail === true;
            opts.showEmptyFolders = opts.showEmptyFolders === true;
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

            let extensionOpt = opts.search.extension;
            if (extensionOpt) {
                if (typeof extensionOpt === 'string') {
                    extensionOpt = [extensionOpt.toLowerCase()];
                } else if (Array.isArray(extensionOpt)) {
                    extensionOpt = extensionOpt.map(ext => String(ext).toLowerCase());
                } else {
                    extensionOpt = null;
                }
            }

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

            if (!file.exists() || !file.isDirectory()) return null;

            const hasContentSearch = !!(opts.search.content || opts.search.contentRegex);

            /**
             * @description 폴더 재귀 탐색
             * @param {java.io.File} directory 탐색할 디렉토리의 File 객체
             * @param {number} depth 현재 탐색 깊이 (들여쓰기에 사용)
             */
            const traverse = (directory, depth) => {
                let items = directory.listFiles();
                if (items === null) return [];

                let itemList = Array.from(items);
                let localLines = [];

                let filteredList = itemList.filter(item => {
                    // 폴더는 항상 포함
                    if (item.isDirectory()) return true;

                    // 이름, 확장자
                    const itemName = item.getName();
                    const itemNameLower = itemName.toLowerCase();
                    const extension = self.utils.getExtension(itemName);

                    if (extensionOpt && !extensionOpt.includes(extension)) return false;
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
                    let prefix = '\u2502  '.repeat(depth - 1) + (i === filteredList.length - 1 ? "\u2514 " : "\u251C ");

                    if (item.isDirectory()) {
                        let childLines = traverse(item, depth + 1);
                        if (childLines.length > 0 || opts.showEmptyFolders) {
                            localLines.push(prefix + item.getName() + '/');
                            localLines = localLines.concat(childLines);
                        }
                    } else {
                        let fileName = prefix + item.getName();
                        if (opts.detail) {
                            let metadata = this.getMetadata(item.getAbsolutePath());
                            if (metadata) {
                                fileName += ` (${metadata.readableSize} / ${metadata.readableLastModified})`;
                            }
                        }
                        localLines.push(fileName);
                    }
                }
                return localLines;
            };

            const treeLines = traverse(file, 1);
            return [file.getName() + '/'].concat(treeLines).join('\n');

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
            let file = this._resolvePath(path);
            if (!file || !file.exists()) return null;

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
        let file = this._resolvePath(path);
        if (!file) return null;

        if (data === undefined) data = "";

        try {
            return FileStream.write(file.getAbsolutePath(), data);
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
        let file = this._resolvePath(path);
        if (!file) return null;
        return FileStream.read(file.getAbsolutePath());
    }

    /**
     * @description 파일 끝부분에 내용 추가
     * @param {string} path 파일 경로
     * @param {string} [data] 추가할 내용
     * @returns {string|null} 전체 파일 내용 | null
     */
    FileManager.prototype.append = function(path, data) {
        let file = this._resolvePath(path);
        if (!file) return null;

        if (data === undefined) data = "";
        try {
            return FileStream.append(file.getAbsolutePath(), data);
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
        let file = this._resolvePath(path);
        if (!file) return false;
        try {
            return FileStream.remove(file.getAbsolutePath());
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
        try {
            let source = this._resolvePath(sourcePath);
            let destination = this._resolvePath(resultPath);

            if (!source || !destination) {
                Log.e("이동 실패: 소스 또는 대상 경로가 유효하지 않습니다.");
                return false;
            }
            if (!source.exists()) {
                Log.e("이동 실패: 소스 파일/폴더를 찾을 수 없습니다: " + sourcePath);
                return false;
            }

            let destParent = destination.getParentFile();
            if (destParent && !destParent.exists()) {
                destParent.mkdirs();
            }

            if (source.renameTo(destination)) {
                return true;
            }

            Log.d("renameTo 실패. 복사 후 삭제 방식으로 이동을 시도합니다.");
            if (this.copy(source.getAbsolutePath(), destination.getAbsolutePath())) {
                return this.remove(source.getAbsolutePath());
            }

            Log.e("이동에 최종 실패했습니다: " + sourcePath);
            return false;
        } catch (e) {
            this._handleError(e, "파일 이동 중 오류 발생");
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
        try {
            let source = this._resolvePath(sourcePath);
            let destination = this._resolvePath(resultPath);

            if (!source || !destination || !source.exists()) {
                Log.e(`복사 실패: 원본(${sourcePath}) 또는 대상(${resultPath}) 경로가 유효하지 않거나 원본이 존재하지 않습니다.`);
                return false;
            }

            // 대상의 부모 디렉토리 생성
            let destParent = destination.getParentFile();
            if (destParent && !destParent.exists()) {
                destParent.mkdirs();
            }

            if (source.isFile()) {
                this._copyFile(source, destination);
            } else if (source.isDirectory()) {
                if (!destination.exists()) {
                    destination.mkdirs();
                }

                let sourceRootPath = String(source.getAbsolutePath());
                if (!sourceRootPath.endsWith(File.separator)) {
                    sourceRootPath += File.separator;
                }
                
                this._traverseDirectory(source.getAbsolutePath(), {
                    onDir: (dir, context) => {
                        let currentPath = String(dir.getAbsolutePath());
                        let relativePath = currentPath.substring(context.sourceRootPath.length);
                        
                        if (relativePath.length > 0) {
                            let newDestDir = new File(context.resultRootPath, relativePath);
                            if (!newDestDir.exists()) newDestDir.mkdirs();
                        }
                    },
                    onFile: (file, context) => {
                        let currentPath = String(file.getAbsolutePath());
                        let relativePath = currentPath.substring(context.sourceRootPath.length);
                        
                        let newDestFile = new File(context.resultRootPath, relativePath);
                        this._copyFile(file, newDestFile);
                    },
                    initialContext: {
                        sourceRootPath: sourceRootPath,
                        resultRootPath: String(destination.getAbsolutePath())
                    },
                    order: 'pre-order'
                });
            }
            return true;
        } catch (e) {
            this._handleError(e, "파일 복사 중 오류 발생");
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
        let sourceFile = this._resolvePath(sourcePath);
        if (!sourceFile || !sourceFile.exists()) {
            Log.e("소스 경로가 존재하지 않거나 유효하지 않습니다.\n시도한 경로: " + sourcePath);
            return null;
        }

        let zipFile;
        if (zipFilePath) {
            zipFile = this._resolvePath(zipFilePath);
            if (!zipFile) {
                Log.e("압축 파일 경로가 유효하지 않습니다.\n시도한 경로: " + zipFilePath);
                return null;
            }
        } else {
            try {
                let parentDir = sourceFile.getParent();
                let baseName = this.utils.getBaseName(sourceFile.getName());
                let resolvedZipPath = parentDir ? `${parentDir}/${baseName}.zip` : `${baseName}.zip`;
                zipFile = new File(resolvedZipPath);
            } catch (e) {
                this._handleError(e);
                return null;
            }
        }

        let fos = null;
        let zos = null;
        try {
            fos = new FileOutputStream(zipFile);
            zos = new ZipOutputStream(fos);
            const _this = this;

            if (sourceFile.isDirectory()) {
                let sourceRootPath = String(sourceFile.getAbsolutePath());
                if (!sourceRootPath.endsWith(File.separator)) {
                    sourceRootPath += File.separator;
                }

                this._traverseDirectory(sourceFile.getAbsolutePath(), {
                    onDir: (dir, context) => {
                        const children = dir.listFiles();
                        if (children === null || children.length === 0) {
                            let currentPath = String(dir.getAbsolutePath());
                            let entryName = currentPath.substring(context.sourceRootPath.length) + '/';
                            if (entryName.length > 1) { // 루트 디렉토리 자체는 제외
                                context.zos.putNextEntry(new ZipEntry(entryName));
                                context.zos.closeEntry();
                            }
                        }
                    },
                    onFile: (file, context) => {
                        let currentPath = String(file.getAbsolutePath());
                        const entryName = currentPath.substring(context.sourceRootPath.length);
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
                        sourceRootPath: sourceRootPath
                    },
                    order: 'pre-order'
                });
            } else { // 단일 파일 압축
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

            return zipFile.getAbsolutePath();

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
        let zipFile = this._resolvePath(zipFilePath);
        if (!zipFile || !zipFile.exists() || zipFile.isDirectory()) {
            Log.e(`${zipFilePath}은/는 파일이 아니거나 유효하지 않습니다.`);
            return null;
        }
    
        let destDirectory;
        if (resultFolderPath) {
            destDirectory = this._resolvePath(resultFolderPath);
            if (!destDirectory) {
                Log.e(`압축 해제 결과 폴더 경로가 유효하지 않습니다: ${resultFolderPath}`);
                return null;
            }
        } else {
            let destDirName = this.utils.getBaseName(zipFile.getName());
            destDirectory = new File(zipFile.getParent(), destDirName);
        }
    
        if (!destDirectory.exists()) {
            destDirectory.mkdirs();
        }
    
        // Zip Slip 방지를 위한 대상 경로 정규화
        let destDirPath;
        try {
            destDirPath = destDirectory.getCanonicalPath();
            if (!destDirPath.endsWith(File.separator)) {
                destDirPath += File.separator;
            }
        } catch (e) {
            this._handleError(e, "대상 경로 정규화 실패");
            return null;
        }
    
        let fis = null;
        let zis = null;
        try {
            fis = new FileInputStream(zipFile);
            zis = new ZipInputStream(fis);
            let zipEntry;
    
            while ((zipEntry = zis.getNextEntry()) != null) {
                let newFile = new File(destDirectory, zipEntry.getName());
                let newFilePath = newFile.getCanonicalPath();
    
                if (!newFilePath.startsWith(destDirPath)) {
                    throw new java.io.IOException("Zip Slip 취약점 의심 - 잘못된 파일 경로입니다: " + zipEntry.getName());
                }
    
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
                    try {
                        this._copyStream(zis, fos);
                    } finally {
                        fos.close();
                    }
                }
                zis.closeEntry();
            }
    
            return destDirectory.getAbsolutePath();
    
        } catch (e) {
            this._handleError(e, "압축 해제 중 오류 발생");
            return null;
        } finally {
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
            const file = this._resolvePath(path);
            if (!file || !file.exists()) return null;

            if (file.isFile()) {
                return this._convertSize(file.length(), targetUnit);
            }

            const context = this._traverseDirectory(file.getAbsolutePath(), {
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
        try {
            let file = this._resolvePath(path);
            if (!file) return false;
            if (!file.exists()) return true;
            if (file.isDirectory()) return this.deleteDirectory(file.getAbsolutePath());
            return file.delete();
        } catch (e) {
            this._handleError(e);
            return false;
        }
    };

    module.exports = FileManager;
})();