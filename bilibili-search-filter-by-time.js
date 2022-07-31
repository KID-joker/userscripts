// ==UserScript==
// @name         Bilibili Search Filter By Time
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  add time filter to bilibili search results
// @author       KID-joker
// @match        https://search.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico?v=1
// @require      https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js
// @grant        GM_log
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    // 设置样式
    let css = `
        @media (max-width: 1099.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
        @media (max-width: 1439.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
        @media (max-width: 1699.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
        @media (max-width: 1919.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
        @media (max-width: 2199.9px) {
            #i_cecream .video-list-item {
                display:block!important;
            }
        }
    `
    GM_addStyle(css)

    // 获取过滤日期
    function getQueryObject(url) {
        url = url == null ? window.location.href : url
        const search = url.substring(url.lastIndexOf('?') + 1)
        const obj = {}
        const reg = /([^?&=]+)=([^?&=]*)/g
        search.replace(reg, (rs, $1, $2) => {
            const name = decodeURIComponent($1)
            let val = decodeURIComponent($2)
            val = String(val)
            obj[name] = val
            return rs
        })
        return obj
    }
    let queryObj = getQueryObject();
    let date = queryObj.date || 'none';
    let dateRange = queryObj.date_range;
    if(date !== 'none') {
        dateRange = dateRange.split('_');
    }

    // 过滤的结果
    let result = [];
    // 日期过滤的页码
    let actualPage = 1;
    // b站对应页面
    let requestPage = 1;
    // 数量
    let pageSize = 0;
    // 没有更多数据
    let finished = false;
    // 最后一个video-item，用于重新加载后滚动到原来位置
    let lastVideo = 0;

    // 重写fetch，拦截fetch请求
    const originFetch = fetch;
    unsafeWindow.fetch = async function(url, options) {
        // 只对视频和专栏搜索接口
        let params = getQueryObject(url);
        if(url.indexOf('x/web-interface/search/type') > -1 && params.search_type === 'video' && date !== 'none') {
            actualPage = params.page;
            pageSize = params.page_size;
            let result = await requestData(url, options);
            let response = new Response();
            response.json = function() {
                return new Promise(resolve => {
                    resolve(result);
                })
            }
            setTimeout(() => {
                replaceLoadBtn();
                eleScroll();
            }, 0);
            return response;
        } else {
            return originFetch(url, options);
        }
    }

    // 获取vue实例、vue-router实例
    let app = null, router = null, route = null;
    if(unsafeWindow.self === unsafeWindow.top) {
        document.addEventListener('DOMContentLoaded', function() {
            app = document.querySelector('#i_cecream').__vue_app__;
            router = app.config.globalProperties.$router;
            route = app.config.globalProperties.$route;
            if(route.name === 'video') {
                insertComponent();
            }
            router.afterEach(route => {
                if(route.name === 'video') {
                    insertComponent();
                }
            })

            // 重写replace方法，拦截跳转，更新route，初始化数据
            const routerReplace = router.replace;
            router.replace = function(toRoute) {
                if(!toRoute.query.date || toRoute.query.date === 'none' || !toRoute.query.page) {
                    route = toRoute;
                    actualPage = 1;
                    requestPage = 1;
                    pageSize = 0;
                    finished = false;
                    lastVideo = 0;
                    return routerReplace.call(this, toRoute);
                } else {
                    lastVideo = result.length - 1;
                }
            }
        })
    }

    // 插入日期过滤组件
    function insertComponent() {
        if(document.querySelector('#date-search-confitions')) {
            return;
        }
        let element = document.createElement('div');
        element.id = 'date-search-confitions';
        element.className = 'search-condition-row';
        element.addEventListener('click', clickDateCondition);
        let fragment = document.createDocumentFragment();
        let list = [{
            name: 'none',
            title: '时间不限'
        }, {
            name: 'day',
            title: '过去1天内'
        }, {
            name: 'week',
            title: '过去1周内'
        }, {
            name: 'month',
            title: '过去1月内'
        }, {
            name: 'year',
            title: '过去1年内'
        }, {
            name: 'custom',
            title: '自定日期范围'
        }]
        list.forEach(function(ele) {
            let button = document.createElement('button');
            button.textContent = ele.title;
            button.className = 'vui_button vui_button--tab mt_sm mr_sm';
            button.dataset.datecondition = ele.name;
            if(ele.name === date) {
                button.className += ' vui_button--active';
            }
            fragment.appendChild(button);
        });
        element.appendChild(fragment);
        document.querySelector('.more-conditions').appendChild(element);
    }

    // 日期过滤点击事件
    function clickDateCondition(evt) {
        let datecondition = evt.target.dataset.datecondition;
        if(datecondition === 'none') {
            // 时间不限
            let { date, date_range, ...query } = route.query;
            router.replace({
                'name': 'video',
                query
            });
            setTimeout(() => {
                router.go(0);
            }, 0);
        } else if(datecondition === 'custom') {
            // 自定义日期范围，弹出日期选择弹窗

        } else {
            // 固定日期范围选择
            let now = Math.floor(Date.now() / 1000);
            let timeMap = {
                'day': 86400,
                'week': 604800,
                'month': 2592000,
                'year': 31536000
            }
            let { page, o, ...query } = route.query;
            query.date = datecondition;
            query.date_range = `${now - timeMap[datecondition]}_${now}`;
            router.replace({
                name: 'video',
                query
            });
            setTimeout(() => {
                router.go(0);
            }, 0);
        }
    }

    // 隐藏分页按钮，替换为查看更多按钮
    function replaceLoadBtn() {
        if(date !== 'none') {
            let pagenationBtnSide = document.querySelectorAll('.vui_pagenation--btn-side');
            if(pagenationBtnSide.length > 1) {
                let loadBtn = pagenationBtnSide[1];
                loadBtn.id = 'date-load-btn';
                loadBtn.textContent = '查看更多';
                
                let parentNode = loadBtn.parentNode;
                while(parentNode.childElementCount > 1) {
                    parentNode.removeChild(parentNode.firstChild);
                }
            }
        }
    }

    function eleScroll() {
        let parentNode = document.querySelector('.video-list');
        if(parentNode && parentNode.childElementCount > lastVideo) {
            parentNode.children[lastVideo].scrollIntoView({behavior: 'smooth', block: 'center', inline: 'nearest'});
        }
    }

    // 请求数据保存
    async function requestData(url, options) {
        while(true) {
            url = url.replace(/page=[0-9]+/, `page=${requestPage}`);
            // 应该是浏览的偏移量，必须跟页码数量保持一致，不然会有重复数据
            url = url.replace(/dynamic_offset=[0-9]+/, `dynamic_offset=${(requestPage - 1) * pageSize}`);
            let data = await originFetch(url, options).then(response => {
                return response.json();
            });
            if(data.data && data.data.result) {
                let list = data.data.result.filter(ele => ele.pubdate >= dateRange[0] && ele.pubdate <= dateRange[1]);
                result = result.concat(list);
            } else {
                // 没有更多数据了
                finished = true;
            }
            requestPage++;
            if(finished || result.length >= actualPage * pageSize) {
                data.data.result = result;
                data.data.page = actualPage;
                return data;
            } else {
                let time = Math.round(Math.random() * 200) + 300;
                await delay(time);
            }
        }
    }

    // 防止请求频繁，被封ip
    function delay(n){
        return new Promise(function(resolve){
            setTimeout(resolve, n);
        });
    }
})();