// ==UserScript==
// @name         Bilibili Search Filter By Time
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  add time filter to bilibili search results
// @author       KID-joker
// @match        https://search.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico?v=1
// @request      https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js
// @grant        GM_log
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
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

    // 获取结果的数量
    let numResult = 0;
    // 日期过滤的页码
    let actualPage = 1;
    // b站对应页面
    let page = 1;
    // 数量
    let pageSize = 0;

    // 重写fetch，拦截fetch请求
    const originFetch = fetch;
    unsafeWindow.fetch = function(url, options) {
        // GM_log("fetch", url);
        // 只对视频和专栏搜索接口
        let params = getQueryObject(url);
        // 应该是预览的偏移量，必须跟页码数量保持一致，不然会有重复数据
        url = url.replace(/dynamic_offset=[0-9]+/, `dynamic_offset=${(params.page - 1) * params.page_size}`)
        if(url.indexOf('x/web-interface/search/type') > -1 && params.search_type === 'video') {
            return new Promise((resolve, reject) => {
                originFetch.call(this, url, options).then(response => {
                    const originJson = response.json;
                    response.json = function() {
                        return new Promise((resolve, reject) => {
                            originJson.call(this).then(result => {
                                // 过滤日期范围
                                if(date !== 'none') {
                                    pageSize = result.data.pagesize;
                                    if(result.data && result.data.result) {
                                        result.data.result = result.data.result.filter(ele => ele.pubdate >= dateRange[0] && ele.pubdate <= dateRange[1]);
                                        GM_log("fetch result", result.data.result);
                                    }

                                    if(unsafeWindow.self === unsafeWindow.top) {
                                        // 显示页面
                                        if(result.data && result.data.result) {
                                            numResult += result.data.result.length;
                                            loadMore();
                                        } else {
                                            hideLoadBtn();
                                        }

                                        setTimeout(() => {
                                            replaceLoadBtn();
                                        }, 0);
                                    } else {
                                        // iframe
                                        if(result.data && result.data.result) {
                                            unsafeWindow.parent.postMessage({
                                                origin: 'iframe',
                                                event: 'loaded'
                                            }, location.origin);
                                        } else {
                                            unsafeWindow.parent.postMessage({
                                                origin: 'iframe',
                                                event: 'finished'
                                            }, location.origin);
                                        }
                                    }
                                }
                                resolve(result);
                            });
                        });
                    };
                    resolve(response);
                });
            });
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
                route = toRoute;
                numResult = 0;
                actualPage = 1;
                page = 1;
                pageSize = 0;
                return routerReplace.call(this, toRoute);
            }
        })
    
        unsafeWindow.addEventListener('message', function(evt) {
            if(evt.origin === location.origin && evt.data.origin && evt.data.origin === 'iframe') {
                if(evt.data.event === 'loaded') {
                    appendVideoItem();
                } else if(evt.data.event === 'finished') {
                    hideLoadBtn();
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
            let pagenation = document.querySelector('.vui_pagenation');
            if(pagenation) {
                let loadBtn = document.createElement('button');
                loadBtn.id = 'date-load-btn';
                loadBtn.className = 'vui_button';
                loadBtn.textContent = '查看更多';
                loadBtn.addEventListener('click', loadMore);
    
                pagenation.parentNode.replaceChild(loadBtn, pagenation);
            }
        }
    }

    // 隐藏查看更多按钮
    function hideLoadBtn() {
        let loadBtn = document.querySelector('#date-load-btn');
        if(loadBtn) {
            loadBtn.parentNode.style.display = 'none';
        }
    }

    // 是否加载更多
    let iframe = null;
    function loadMore() {
        // 判断是否iframe
        if(unsafeWindow.self === unsafeWindow.top) {
            // 数量不够
            if(numResult < actualPage * pageSize) {
                // 判断是否已经创建过iframe
                if(!iframe) {
                    iframe = document.createElement('iframe');
                    iframe.width = '100vw';
                    iframe.height = '0';
                    document.body.appendChild(iframe);
                }
    
                // 加载原来页码
                page++;
                let url = location.href + `&page=${page}`;
                iframe.src = url;
            } else {
                // 可以点击查看更多
                actualPage++;
            }
        }
    }

    // 截取iframe video-item拼接到当前页面
    function appendVideoItem() {
        let parentNode = document.querySelector('.video-list');
        let fragment = document.createDocumentFragment();
        let iframeDocument = iframe.contentWindow.document;
        let videoList = iframeDocument.querySelector('.video-list');
        if(videoList) {
            let nodeList = videoList.children;
            numResult += nodeList.length;
            if(parentNode) {
                // 第一页有数据
                fragment.append(...nodeList);
                parentNode.appendChild(fragment);
            } else {
                // 第一页数据为空
                let noDataNode = document.querySelector('.search-nodata-container');
                noDataNode.parentNode.replaceChild(videoList.parentNode, noDataNode);
                replaceLoadBtn();
            }
        }
        loadMore();
    }
})();