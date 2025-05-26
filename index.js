export default {
  async fetch(request, env) {
    try {
      if (request.method === 'POST') {
        // ===================== 密码存储与读取相关 =====================
        // 管理密码存储在 Cloudflare Worker 绑定的 KV 命名空间 urlshow_pass 中，key 为 'password'
        // 如需修改密码，请在 Cloudflare Dashboard 或 wrangler 工具中修改 urlshow_pass 的 password 键值
        // 读取方式如下：
        const correctPassword = await env.urlshow_pass.get('password');
        // ===================== 密码存储与读取相关 =====================

        // 克隆请求体以便多次使用
        const requestClone = request.clone();
        const { type } = await requestClone.json();
        
        if (type === 'init') {
          // 获取基础链接数据
          const { results } = await env.web_links.prepare(
            'SELECT name, url FROM urls'
          ).all();
          return new Response(JSON.stringify({ data: results }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else if (type === 'verify') {
          // 处理密码验证请求
          const { password } = await request.json();
          
          if (password === correctPassword) {
            const { results: extraResults } = await env.web_links.prepare(
              'SELECT name, url FROM hide_urls'
            ).all();
            
            return new Response(JSON.stringify({ 
              success: true, 
              data: extraResults 
            }), {
              headers: { 'Content-Type': 'application/json' },
            });
          } else {
            return new Response(JSON.stringify({ success: false }), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
        } else if (type === 'addUrl') {
          // 处理添加新URL的请求
          try {
            const { name, url, urlType, password } = await request.json();
            
            // 参数验证
            if (!name || !url || !urlType || !password) {
              return new Response(JSON.stringify({ 
                success: false, 
                message: '缺少必要参数' 
              }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }

            // URL格式验证
            try {
              new URL(url);
            } catch (e) {
              return new Response(JSON.stringify({ 
                success: false, 
                message: 'URL格式不正确' 
              }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }

            if (!correctPassword) {
              return new Response(JSON.stringify({ 
                success: false, 
                message: '系统配置错误：未设置密码' 
              }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }

            if (password !== correctPassword) {
              return new Response(JSON.stringify({ 
                success: false, 
                message: '验证失败' 
              }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }

            if (urlType !== 'public' && urlType !== 'private') {
              return new Response(JSON.stringify({ 
                success: false, 
                message: '无效的URL类型' 
              }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }

            try {
              const tableName = urlType === 'public' ? 'urls' : 'hide_urls';
              
              // 检查表是否存在
              const tableExists = await env.web_links.prepare(
                `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
              ).bind(tableName).all();

              if (!tableExists.results.length) {
                return new Response(JSON.stringify({ 
                  success: false, 
                  message: '数据库表不存在' 
                }), {
                  headers: { 'Content-Type': 'application/json' },
                });
              }

              await env.web_links.prepare(
                `INSERT INTO ${tableName} (name, url) VALUES (?, ?)`
              ).bind(name, url).run();

              return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' },
              });
            } catch (error) {
              console.error('Database error:', error);
              return new Response(JSON.stringify({ 
                success: false, 
                message: '数据库操作失败：' + error.message 
              }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }
          } catch (error) {
            console.error('Request processing error:', error);
            return new Response(JSON.stringify({ 
              success: false, 
              message: '请求处理失败：' + error.message 
            }), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
        } else if (type === 'deleteUrl') {
          // 处理删除URL的请求
          try {
            const { name, url, urlType, password } = await request.json();
            
            // 验证密码
            if (!correctPassword) {
              return new Response(JSON.stringify({ 
                success: false, 
                message: '系统配置错误：未设置密码' 
              }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }

            if (password !== correctPassword) {
              return new Response(JSON.stringify({ 
                success: false, 
                message: '验证失败' 
              }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }

            // 执行删除操作
            const tableName = urlType === 'public' ? 'urls' : 'hide_urls';
            await env.web_links.prepare(
              `DELETE FROM ${tableName} WHERE name = ? AND url = ?`
            ).bind(name, url).run();

            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (error) {
            console.error('Delete URL error:', error);
            return new Response(JSON.stringify({ 
              success: false, 
              message: '删除失败：' + error.message 
            }), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
      }

      // 生成初始HTML页面
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>网址导航页</title>
            <style>
              :root {
                --primary-color: #2563eb;
                --hover-color: #1d4ed8;
                --bg-color: #f8fafc;
                --card-bg: #ffffff;
              }
              
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
                background-color: var(--bg-color);
                max-width: 1000px;
                margin: 0 auto;
                padding: 20px;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
              }

              .link-list {
                list-style: none;
                padding: 0;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 20px;
                animation: fadeIn 0.5s ease-in;
              }

              .link-item {
                padding: 0;
                margin: 0;
              }

              .link-item a {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                color: var(--primary-color);
                background: var(--card-bg);
                text-decoration: none;
                border-radius: 12px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                font-size: 16px;
                font-weight: 500;
                height: 60px;
              }

              .link-item a:hover {
                background-color: var(--primary-color);
                color: white;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
              }

              @keyframes fadeIn {
                from {
                  opacity: 0;
                  transform: translateY(10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }

              @media (max-width: 768px) {
                body {
                  padding: 15px;
                }
                
                .link-list {
                  grid-template-columns: 1fr;
                  gap: 15px;
                }

                .link-item a {
                  padding: 15px;
                  height: 50px;
                }
              }

              @media (prefers-color-scheme: dark) {
                :root {
                  --primary-color: #60a5fa;
                  --hover-color: #3b82f6;
                  --bg-color: #0f172a;
                  --card-bg: #1e293b;
                }
                
                body {
                  color: #e2e8f0;
                }
              }

              .divider {
                margin: 40px 0;
                border: none;
                border-top: 1px solid var(--primary-color);
                opacity: 0.2;
              }

              .admin-section {
                text-align: center;
              }

              .admin-button {
                padding: 10px 20px;
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.3s;
                margin: 0 5px;
              }

              .admin-button:hover {
                background: var(--hover-color);
              }

              .admin-button.delete-mode {
                background: #dc2626;
              }

              .admin-button.delete-mode:hover {
                background: #b91c1c;
              }

              .delete-mode-active .delete-button {
                display: flex !important;
              }

              .delete-mode-active .link-item:hover .delete-button {
                display: flex !important;
              }

              .password-section {
                margin-top: 20px;
                text-align: center;
                display: none;
              }

              .password-input {
                padding: 10px;
                border: 1px solid var(--primary-color);
                border-radius: 6px;
                margin-right: 10px;
                background: var(--card-bg);
                color: inherit;
              }

              .add-url-form {
                margin: 20px auto;
                max-width: 500px;
                padding: 20px;
                background: var(--card-bg);
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                display: none;
              }

              .form-group {
                margin-bottom: 15px;
              }

              .form-group label {
                display: block;
                margin-bottom: 5px;
              }

              .form-input {
                width: 100%;
                padding: 10px;
                border: 1px solid var(--primary-color);
                border-radius: 6px;
                background: var(--card-bg);
                color: inherit;
                margin-bottom: 10px;
                box-sizing: border-box;
              }

              .radio-group {
                display: flex;
                gap: 20px;
                margin: 10px 0;
              }

              .hidden {
                display: none;
              }

              /* 模态窗口样式 */
              .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 1000;
              }

              .modal-content {
                position: relative;
                background-color: var(--card-bg);
                margin: 15% auto;
                padding: 24px;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                animation: slideIn 0.3s ease-out;
              }

              @keyframes slideIn {
                from {
                  transform: translateY(-100px);
                  opacity: 0;
                }
                to {
                  transform: translateY(0);
                  opacity: 1;
                }
              }

              .close-modal {
                position: absolute;
                right: 20px;
                top: 15px;
                font-size: 24px;
                cursor: pointer;
                color: var(--primary-color);
              }

              .link-item {
                position: relative;
              }

              .delete-button {
                position: absolute;
                right: -10px;
                top: -10px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #dc2626;
                color: white;
                border: none;
                cursor: pointer;
                display: none;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                z-index: 2;
              }

              .link-item:hover .delete-button {
                display: none;
              }

              .modal-title {
                margin-top: 0;
                margin-bottom: 20px;
                color: var(--primary-color);
              }

              /* 新增：自定义确认弹窗样式 */
              .confirm-modal .modal-content {
                text-align: center;
              }
              .confirm-modal .modal-actions {
                margin-top: 24px;
                display: flex;
                justify-content: center;
                gap: 20px;
              }
              .confirm-modal .modal-btn {
                padding: 8px 24px;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                transition: background 0.2s;
              }
              .confirm-modal .modal-btn.confirm {
                background: var(--primary-color);
                color: #fff;
              }
              .confirm-modal .modal-btn.confirm:hover {
                background: var(--hover-color);
              }
              .confirm-modal .modal-btn.cancel {
                background: #e5e7eb;
                color: #222;
              }
              .confirm-modal .modal-btn.cancel:hover {
                background: #cbd5e1;
              }

              /* 新增：自定义消息弹窗样式 */
              .message-modal .modal-content {
                text-align: center;
              }
              .message-modal .modal-actions {
                margin-top: 24px;
                display: flex;
                justify-content: center;
              }
              .message-modal .modal-btn {
                padding: 8px 32px;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                background: var(--primary-color);
                color: #fff;
                transition: background 0.2s;
              }
              .message-modal .modal-btn:hover {
                background: var(--hover-color);
              }
            </style>
          </head>
          <body>
            <ul class="link-list" id="mainList"></ul>

            <hr class="divider">
            
            <div class="admin-section">
              <button class="admin-button" id="showVerifyBtn">管理</button>
              <div class="password-section" id="verifySection">
                <input type="password" class="password-input" placeholder="请输入管理密码" id="verifyInput">
                <button class="admin-button" onclick="verify()">确认</button>
              </div>
            </div>

            <!-- 添加URL的模态窗口 -->
            <div id="addUrlModal" class="modal">
              <div class="modal-content">
                <span class="close-modal" onclick="closeModal()">&times;</span>
                <h2 class="modal-title">添加新网址</h2>
                <div class="form-group">
                  <label>网址名称：</label>
                  <input type="text" class="form-input" id="urlName" required>
                </div>
                <div class="form-group">
                  <label>URL地址：</label>
                  <input type="url" class="form-input" id="urlAddress" required>
                </div>
                <div class="form-group">
                  <label>显示区域：</label>
                  <div class="radio-group">
                    <label>
                      <input type="radio" name="urlType" value="public" checked> 公开区域
                    </label>
                    <label>
                      <input type="radio" name="urlType" value="private"> 验证后显示
                    </label>
                  </div>
                </div>
                <button class="admin-button" onclick="addNewUrl()">添加网址</button>
              </div>
            </div>

            <!-- 新增：自定义删除确认弹窗 -->
            <div id="confirmModal" class="modal confirm-modal">
              <div class="modal-content">
                <h2 class="modal-title">确认删除</h2>
                <div id="confirmMessage">确定要删除这个网址吗？</div>
                <div class="modal-actions">
                  <button class="modal-btn confirm" id="confirmYesBtn">确定</button>
                  <button class="modal-btn cancel" id="confirmNoBtn">取消</button>
                </div>
              </div>
            </div>

            <!-- 新增：自定义消息弹窗 -->
            <div id="messageModal" class="modal message-modal">
              <div class="modal-content">
                <h2 class="modal-title" id="messageModalTitle">提示</h2>
                <div id="messageModalContent"></div>
                <div class="modal-actions">
                  <button class="modal-btn" id="messageModalOkBtn">确定</button>
                </div>
              </div>
            </div>

            <ul class="link-list" id="extraList"></ul>

            <script>
              // 页面加载时获取基础数据
              async function initializeData() {
                try {
                  const response = await fetch('', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ type: 'init' }),
                  });
                  
                  const result = await response.json();
                  const mainList = document.getElementById('mainList');
                  renderUrlList(mainList, result.data, false, false);
                } catch (error) {
                  showMessageModal('初始化失败');
                }
              }

              // 页面加载完成后执行初始化
              document.addEventListener('DOMContentLoaded', function() {
                document.getElementById('showVerifyBtn').addEventListener('click', showVerification);
                initializeData();
              });

              function showVerification() {
                const verifySection = document.getElementById('verifySection');
                const adminButton = document.querySelector('.admin-button');
                const verifyInput = document.getElementById('verifyInput');
                
                verifySection.style.display = 'block';
                adminButton.style.display = 'none';
                verifyInput.focus();
              }

              document.getElementById('verifyInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                  verify();
                }
              });

              async function verify() {
                const password = document.getElementById('verifyInput').value;
                try {
                  // 先获取公开区数据
                  const pubRes = await fetch('', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ type: 'init' }),
                  });
                  const pubResult = await pubRes.json();

                  // 再验证密码获取隐藏区数据
                  const response = await fetch('', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                      type: 'verify',
                      password 
                    }),
                  });
                  const result = await response.json();
                  if (result.success) {
                    const mainList = document.getElementById('mainList');
                    renderUrlList(mainList, pubResult.data, true, false);
                    const extraList = document.getElementById('extraList');
                    renderUrlList(extraList, result.data, true, true);
                    document.getElementById('verifySection').style.display = 'none';
                    // 添加管理按钮
                    const adminSection = document.querySelector('.admin-section');
                    if (!document.getElementById('addUrlBtn')) {
                      const addButton = document.createElement('button');
                      addButton.id = 'addUrlBtn';
                      addButton.className = 'admin-button';
                      addButton.onclick = showModal;
                      addButton.textContent = '添加网址';
                      adminSection.appendChild(addButton);

                      const deleteModeBtn = document.createElement('button');
                      deleteModeBtn.id = 'deleteModeBtn';
                      deleteModeBtn.className = 'admin-button';
                      deleteModeBtn.onclick = toggleDeleteMode;
                      deleteModeBtn.textContent = '删除模式';
                      adminSection.appendChild(deleteModeBtn);

                      const exitAdminBtn = document.createElement('button');
                      exitAdminBtn.id = 'exitAdminBtn';
                      exitAdminBtn.className = 'admin-button';
                      exitAdminBtn.onclick = exitAdmin;
                      exitAdminBtn.textContent = '退出管理';
                      adminSection.appendChild(exitAdminBtn);
                    }
                  } else {
                    showMessageModal('验证失败，请重试');
                  }
                } catch (error) {
                  showMessageModal('请求失败，请重试');
                }
              }

              function toggleDeleteMode() {
                const deleteModeBtn = document.getElementById('deleteModeBtn');
                const mainList = document.getElementById('mainList');
                const extraList = document.getElementById('extraList');
                
                if (deleteModeBtn.textContent === '删除模式') {
                  deleteModeBtn.textContent = '退出删除';
                  deleteModeBtn.classList.add('delete-mode');
                  mainList.classList.add('delete-mode-active');
                  extraList.classList.add('delete-mode-active');
                } else {
                  deleteModeBtn.textContent = '删除模式';
                  deleteModeBtn.classList.remove('delete-mode');
                  mainList.classList.remove('delete-mode-active');
                  extraList.classList.remove('delete-mode-active');
                }
              }

              function exitAdmin() {
                // 如果当前在删除模式下，先退出删除模式
                const deleteModeBtn = document.getElementById('deleteModeBtn');
                if (deleteModeBtn && deleteModeBtn.textContent === '退出删除') {
                  toggleDeleteMode();
                }

                // 移除所有管理按钮
                const adminSection = document.querySelector('.admin-section');
                document.getElementById('addUrlBtn').remove();
                document.getElementById('deleteModeBtn').remove();
                document.getElementById('exitAdminBtn').remove();
                
                // 显示验证按钮
                const verifyBtn = document.getElementById('showVerifyBtn');
                verifyBtn.style.display = 'inline-block';
                
                // 清空密码输入
                document.getElementById('verifyInput').value = '';
                
                // 清空隐藏区域
                const extraList = document.getElementById('extraList');
                extraList.innerHTML = '';
                
                // 重新初始化页面
                initializeData();
              }

              async function addNewUrl() {
                const name = document.getElementById('urlName').value.trim();
                const url = document.getElementById('urlAddress').value.trim();
                const type = document.querySelector('input[name="urlType"]:checked').value;
                const password = document.getElementById('verifyInput').value;

                if (!name || !url) {
                  showMessageModal('请填写完整信息');
                  return;
                }

                try {
                  const response = await fetch('', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      type: 'addUrl',
                      name,
                      url,
                      urlType: type,
                      password
                    }),
                  });

                  const result = await response.json();
                  if (result.success) {
                    showMessageModal('添加成功');
                    // 清空表单
                    document.getElementById('urlName').value = '';
                    document.getElementById('urlAddress').value = '';
                    // 关闭模态框
                    closeModal();
                    
                    // 检查当前是否在删除模式
                    const deleteModeBtn = document.getElementById('deleteModeBtn');
                    const isDeleteMode = deleteModeBtn && deleteModeBtn.textContent === '退出删除';
                    
                    // 刷新数据
                    if (type === 'private') {
                      verify();
                    } else {
                      // 重新获取公开区数据
                      const pubRes = await fetch('', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ type: 'init' }),
                      });
                      const pubResult = await pubRes.json();
                      const mainList = document.getElementById('mainList');
                      renderUrlList(mainList, pubResult.data, isDeleteMode, false);
                    }
                  } else {
                    showMessageModal(result.message || '添加失败');
                  }
                } catch (error) {
                  showMessageModal('请求失败，请重试');
                }
              }

              function showModal() {
                // 如果当前在删除模式下，先退出删除模式
                const deleteModeBtn = document.getElementById('deleteModeBtn');
                if (deleteModeBtn && deleteModeBtn.textContent === '退出删除') {
                  toggleDeleteMode();
                }
                document.getElementById('addUrlModal').style.display = 'block';
              }

              function closeModal() {
                document.getElementById('addUrlModal').style.display = 'none';
              }

              // 点击模态窗口外部关闭
              window.onclick = function(event) {
                const modal = document.getElementById('addUrlModal');
                if (event.target === modal) {
                  closeModal();
                }
              }

              // 自定义删除确认弹窗逻辑
              let pendingDelete = null;
              function showConfirmModal(onConfirm) {
                const modal = document.getElementById('confirmModal');
                modal.style.display = 'block';
                pendingDelete = onConfirm;
              }
              function closeConfirmModal() {
                const modal = document.getElementById('confirmModal');
                modal.style.display = 'none';
                pendingDelete = null;
              }
              document.getElementById('confirmYesBtn').onclick = function() {
                if (pendingDelete) pendingDelete();
                closeConfirmModal();
              };
              document.getElementById('confirmNoBtn').onclick = function() {
                closeConfirmModal();
              };

              async function deleteUrl(name, url, isPrivate) {
                showConfirmModal(async function() {
                  try {
                    const response = await fetch('', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        type: 'deleteUrl',
                        name,
                        url,
                        urlType: isPrivate ? 'private' : 'public',
                        password: document.getElementById('verifyInput').value
                      }),
                    });

                    const result = await response.json();
                    if (result.success) {
                      showMessageModal('删除成功');
                      // 保持删除模式状态
                      const deleteModeBtn = document.getElementById('deleteModeBtn');
                      const isDeleteMode = deleteModeBtn.textContent === '退出删除';
                      
                      if (isPrivate) {
                        verify();
                      } else {
                        // 重新获取公开区数据
                        const pubRes = await fetch('', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ type: 'init' }),
                        });
                        const pubResult = await pubRes.json();
                        const mainList = document.getElementById('mainList');
                        renderUrlList(mainList, pubResult.data, isDeleteMode, false);
                      }
                    } else {
                      showMessageModal(result.message || '删除失败');
                    }
                  } catch (error) {
                    showMessageModal('请求失败，请重试');
                  }
                });
              }

              function renderUrlList(container, data, showDelete = false, isPrivate = false) {
                container.innerHTML = data.map(function(item) {
                  return '<li class="link-item">'
                    + (showDelete
                        ? '<button class="delete-button" data-name="' + encodeURIComponent(item.name) + '" data-url="' + encodeURIComponent(item.url) + '" data-private="' + isPrivate + '">×</button>'
                        : '')
                    + '<a href="' + item.url + '" target="_blank" rel="noopener noreferrer">'
                    + item.name
                    + '</a>'
                    + '</li>';
                }).join('');
              }

              // 事件委托，监听所有删除按钮
              document.body.addEventListener('click', function(e) {
                if (e.target.classList && e.target.classList.contains('delete-button')) {
                  const name = decodeURIComponent(e.target.getAttribute('data-name'));
                  const url = decodeURIComponent(e.target.getAttribute('data-url'));
                  const isPrivate = e.target.getAttribute('data-private') === 'true';
                  deleteUrl(name, url, isPrivate);
                }
              });

              // 自定义消息弹窗逻辑
              function showMessageModal(message, callback, title = '提示') {
                document.getElementById('messageModalTitle').textContent = title;
                document.getElementById('messageModalContent').textContent = message;
                const modal = document.getElementById('messageModal');
                modal.style.display = 'block';
                document.getElementById('messageModalOkBtn').onclick = function() {
                  modal.style.display = 'none';
                  if (callback) callback();
                };
              }
            </script>
          </body>
        </html>
      `;

      // 返回HTML响应
      return new Response(html, {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
          'Cache-Control': 'no-store',
        },
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response('系统繁忙，请稍后再试', {
        status: 500,
        headers: {
          'content-type': 'text/plain;charset=UTF-8',
        },
      });
    }
  },
};
