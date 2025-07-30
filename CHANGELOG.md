# Changelog

모든 중요한 변경 사항은 이 파일에 기록됩니다.

## [1.1.2] - 2025-07-30
### 변경
- 다른 모듈 등에서 이용하는 경우에 대비해 bind 처리
- `getMetadata`, `getStorageSize`에서 단위 자동 포맷팅 처리
- LLM Function Call에 대비해 `_normalizePath`를 이용해 경로 정규화 처리

## [1.1.1] - 2025-07-29
### 변경
- `getDirectoryTree`에서 경로 미설정 혹은 `.`, `/` 등을 입력 시 접근 가능한 모든 파일 목록을 반환하도록 수정

## [1.1.0] - 2025-07-28
### 추가
- FileManager 생성 시, 샌드박스 기본 경로를 설정할 수 있도록 추가
- 샌드박스 기본 경로를 설정하면, 파일 작업 시 해당 경로 내에서만 작업 가능

## [1.0.3] - 2025-07-28
### 변경
- `getDirectoryTree`에서 간혹 에러가 발생하던 문제 수정

## [1.0.2] - 2025-07-28
### 변경
- `getDirectoryTree`에서 `extension`를 배열로도 받도록 수정

## [1.0.1] - 2025-07-28
### 변경
- `getDirectoryTree`에서 `extention` 옵션이 동작하지 않는 문제 수정
- `getDirectoryTree`에 `showEmptyFolders` 옵션 추가

## [1.0.0] - 2025-07-28
### 출시
- 최초 릴리즈