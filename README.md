# FileManager for 메신저봇R

**FileManager**는 카카오톡 봇 개발 앱인 **메신저봇R** 전용으로 제작된 파일 및 폴더 유틸리티 모듈입니다. 다양한 파일/디렉토리 작업을 간편하게 처리할 수 있도록 통합된 API를 제공합니다.

## 주요 특징
- 폴더 생성/삭제, 트리 구조 조회
- 파일 생성/읽기/쓰기/삭제/추가
- 파일 및 폴더 이동/복사
- ZIP 압축/해제
- 파일/폴더 용량 계산
- 파일/폴더 메타데이터 조회

## 설치 및 적용

1. `FileManager.js` 파일을 메신저봇R의 모듈 폴더에 복사합니다.
2. 아래와 같이 모듈을 불러와 사용할 수 있습니다.

```javascript
const FM = require("FileManager");
const FileManager = new FM;

Log.i(FileManager.getDirectoryTree("sdcard/msgbot"));
```

## 사용 예시

### 폴더 구조 출력
```javascript
Log.i(FileManager.getDirectoryTree("sdcard/msgbot"));
```

### 폴더 생성
```javascript
FileManager.createDirectory("sdcard/msgbot/test");
```

### 파일 생성 및 쓰기
```javascript
FileManager.write("sdcard/msgbot/test/hello.txt", "Hello, world!");
```

### 파일 읽기
```javascript
const content = FileManager.read("sdcard/msgbot/test/hello.txt");
```

### 파일/폴더 복사
```javascript
FileManager.copy("sdcard/msgbot/test/hello.txt", "sdcard/msgbot/backup");
```

### ZIP 압축
```javascript
FileManager.zip("sdcard/msgbot/test", "sdcard/msgbot/test.zip");
```

### ZIP 해제
```javascript
FileManager.unzip("sdcard/msgbot/test.zip", "sdcard/msgbot/unzipped");
```

## 지원 함수 목록
- `createDirectory(path)` : 폴더 생성
- `deleteDirectory(path)` : 폴더 및 하위 파일 삭제
- `getDirectoryTree(path, options)` : 폴더 구조 조회
- `getMetadata(path)` : 파일/폴더 메타데이터 조회
- `write(path, data)` : 파일 생성 및 쓰기
- `read(path)` : 파일 읽기
- `append(path, data)` : 파일 끝에 내용 추가
- `delete(path)` : 파일 삭제
- `move(sourcePath, resultPath)` : 파일/폴더 이동
- `copy(sourcePath, resultPath)` : 파일/폴더 복사
- `zip(sourcePath, zipFilePath)` : ZIP 압축
- `unzip(zipFilePath, resultFolderPath)` : ZIP 해제
- `getStorageSize(path, unit)` : 파일/폴더 용량 계산
- `remove(path)` : 파일/폴더 삭제

## 라이선스

이 프로젝트는 [CC BY-NC-SA 4.0](./LICENSE) 라이선스를 따릅니다. 