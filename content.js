// Entry World Info Display Content Script

(function() {
    'use strict';

    // URL 패턴 검사: https://space.playentry.org/world/[ID] (하위 경로 없음)
    function isValidWorldPage() {
        const url = window.location.href;
        const pattern = /^https:\/\/space\.playentry\.org\/world\/[^\/]+\/?$/;
        return pattern.test(url);
    }

    // URL에서 월드 ID 추출
    function getWorldId() {
        const url = window.location.href;
        const match = url.match(/^https:\/\/space\.playentry\.org\/world\/([^\/]+)\/?$/);
        return match ? match[1] : null;
    }

    // 페이지에서 CSRF 토큰 찾기
    function getCsrfToken() {
        // 메타 태그에서 찾기
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }

        // 스크립트나 다른 방법으로 찾기 (Entry 사이트 구조에 따라 조정 필요)
        // 일반적으로 페이지 소스나 전역 변수에 있을 수 있음
        try {
            // window 객체에서 찾기
            if (window.csrfToken) {
                return window.csrfToken;
            }
            
            // localStorage나 sessionStorage에서 찾기
            const token = localStorage.getItem('csrfToken') || sessionStorage.getItem('csrfToken');
            if (token) {
                return token;
            }
        } catch (e) {
            console.warn('CSRF token not found in common places');
        }

        // 기본값 사용 (완전한 실패 시)
        return "pQugeyA3-IhtGAFekV2yshB-zIl1V6YzZOdg"; // 작동 안함
    }

    // GraphQL API 호출
    async function fetchWorldData(worldId) {
        const csrfToken = getCsrfToken();
        
        const query = `
            query getWorld($id: String!) {
                getWorld(id: $id) {
                    ...WorldFields
                }
            }
            
            fragment WorldFields on World {
                ...BaseWorldFields
                description
                image {
                    ...SpacePictureFields
                }
                tags
                todayVisitCount
                bookmarkCount
                commentCount
            }
            
            fragment BaseWorldFields on World {
                id
                name
                primaryMapImage {
                    thumbnail
                }
                cheer {
                    ...CheerCountFields
                }
                visitCount
                maxChannelCount
                maxChannelUsers
                user {
                    ...UserFields
                }
                locked
                fps
                staffPicked
                ranked
                published
                publishedAt
                blindType
                blindAt
                disableRealtime
                removed
                removedAt
                createdAt
                updatedAt
            }
            
            fragment CheerCountFields on CheerCount {
                total
                best
                good
                impressive
                fun
                amazing
            }
            
            fragment UserFields on User {
                id
                nickname
                role
                spaceRole
                spaceDescription
                spaceAvatarThumbnail
                spaceFriendCount
                spaceVisitWorldCount
                spaceWorld {
                    id
                }
                primaryGroup {
                    ...GroupFields
                }
                mark {
                    id
                    filename
                    imageType
                }
            }
            
            fragment GroupFields on Group {
                id
                teacher
            }
            
            fragment SpacePictureFields on SpacePicture {
                origin {
                    ...PictureFields
                }
                thumbnail
            }
            
            fragment PictureFields on Picture {
                id
                fileName
                url
                path
                width
                height
                fileSize
                thumbnail
                imageType
                createdAt
                updatedAt
            }
        `;

        const requestBody = {
            query: query,
            variables: { id: worldId },
            operationName: "getWorld"
        };

        try {
            const response = await fetch("https://space.playentry.org/graphql/getWorld", {
                method: "POST",
                headers: {
                    "accept": "*/*",
                    "accept-language": "en-US,en;q=0.7",
                    "apollo-require-preflight": "true",
                    "content-type": "application/json",
                    "csrf-token": csrfToken,
                    "priority": "u=1, i",
                    "sec-ch-ua": '"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Linux"',
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "sec-gpc": "1",
                    "x-client-type": "Client"
                },
                body: JSON.stringify(requestBody),
                mode: "cors",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching world data:', error);
            return null;
        }
    }

    // 날짜 포맷팅 (ISO 8601 -> YY.MM.DD)
    function formatDate(isoDateString) {
        try {
            const date = new Date(isoDateString);
            const fullDate = date.toISOString().split('T')[0].replace(/-/g, '.');
            // 년도를 두 자리로 변경 (YYYY.MM.DD -> YY.MM.DD)
            return fullDate.substring(2); // 앞의 두 자리 제거
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Unknown';
        }
    }

    // DOM에 정보 주입
    function injectWorldInfo(worldData) {
        const world = worldData?.data?.getWorld;
        if (!world) {
            console.error('No world data found');
            return;
        }

        // 대상 div 찾기
        const targetDiv = document.querySelector('.css-1a7dy9c.eu6qb932');
        if (!targetDiv) {
            console.error('Target div not found');
            return;
        }

        // 이전에 추가된 확장 프로그램 요소들 제거
        const existingElements = targetDiv.querySelectorAll('em[data-entry-extension]');
        existingElements.forEach(element => element.remove());

        // em 요소들 찾기
        const emElements = targetDiv.querySelectorAll('em:not([data-entry-extension])');
        const firstEm = emElements[0];
        const lastEm = emElements[emElements.length - 1];
        
        if (!firstEm || !lastEm) {
            console.error('No em elements found in target div');
            return;
        }

        // 업데이트 날짜를 맨 위 em 아래에 추가
        if (world.updatedAt) {
            const updateDate = formatDate(world.updatedAt);
            const updateEm = document.createElement('em');
            updateEm.textContent = `업데이트 ${updateDate}`;
            updateEm.setAttribute('data-entry-extension', 'update');
            firstEm.parentNode.insertBefore(updateEm, firstEm.nextSibling);
        }

        // 하단에 추가할 요소들을 배열에 저장
        const bottomElementsToAdd = [];
        
        // staffPicked 상태 추가 (스월)
        if (world.staffPicked) {
            const staffPickedEm = document.createElement('em');
            staffPickedEm.textContent = '스월';
            staffPickedEm.style.color = 'rgb(255, 67, 32)';
            staffPickedEm.setAttribute('data-entry-extension', 'staff-picked');
            bottomElementsToAdd.push(staffPickedEm);
        }

        // ranked 상태 추가 (인월)
        if (world.ranked) {
            const rankedEm = document.createElement('em');
            rankedEm.textContent = '인월';
            rankedEm.style.color = 'rgb(0, 142, 255)';
            rankedEm.setAttribute('data-entry-extension', 'ranked');
            bottomElementsToAdd.push(rankedEm);
        }

        // 스월/인월을 맨 아래에 순서대로 추가
        let insertAfter = lastEm;
        bottomElementsToAdd.forEach(element => {
            insertAfter.parentNode.insertBefore(element, insertAfter.nextSibling);
            insertAfter = element; // 다음 요소는 현재 요소 뒤에 추가
        });
    }

    // 메인 실행 함수
    async function main() {
        // URL 검사
        if (!isValidWorldPage()) {
            return; // 유효한 월드 페이지가 아니면 종료
        }

        console.log('Entry World Info Extension activated');

        // 월드 ID 추출
        const worldId = getWorldId();
        if (!worldId) {
            console.error('Could not extract world ID from URL');
            return;
        }

        console.log('World ID:', worldId);

        // 페이지가 완전히 로드될 때까지 대기
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', main);
            return;
        }

        // 대상 요소가 나타날 때까지 대기 (SPA일 수 있으므로)
        let attempts = 0;
        const maxAttempts = 20;
        const checkInterval = 500; // 0.5초

        const waitForElement = () => {
            const targetDiv = document.querySelector('.css-1a7dy9c.eu6qb932');
            
            if (targetDiv && targetDiv.querySelectorAll('em').length > 0) {
                // 요소를 찾았으면 API 호출 및 정보 주입
                fetchWorldData(worldId)
                    .then(worldData => {
                        if (worldData) {
                            injectWorldInfo(worldData);
                        }
                    });
                return;
            }

            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(waitForElement, checkInterval);
            } else {
                console.warn('Target element not found after maximum attempts');
            }
        };

        waitForElement();
    }

    // 페이지 로드 시 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

    // SPA에서 URL 변경 감지 (pushstate/popstate)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(main, 1000); // URL 변경 후 약간의 지연
        }
    }).observe(document, { subtree: true, childList: true });

})();
