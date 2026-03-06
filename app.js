// ===== 工作计划管理系统 v2.1 - Vue 3 应用 =====

// Supabase 配置
const SUPABASE_URL = 'https://aqdjghoroqzbasfkoinp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L4wpM4nLxHRYv5OucbQlLQ_X8EJMEOR';

// 初始化 Supabase 客户端
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const { createApp, ref, computed, onMounted, watch } = Vue;

createApp({
    setup() {
        // ===== 状态 =====
        const loading = ref(true);
        const user = ref(null);
        const profile = ref(null);
        const authMode = ref('login');
        const authForm = ref({ email: '', password: '', name: '', department: '' });
        const authError = ref('');

        const currentView = ref('dashboard');
        const myPlans = ref([]);
        const allPlans = ref([]);
        const visibilitySettings = ref([]);
        const allProfiles = ref([]);

        // ===== v2.0 新增 =====
        const sidebarCollapsed = ref(false);
        const showDrawer = ref(false);
        const settingsTab = ref('password');

        // 弹窗状态
        const showCommentModal = ref(false);
        const showEditModal = ref(false);
        const showDetailModal = ref(false);
        const showRegisterSuccess = ref(false);
        const selectedPlan = ref(null);
        const planComments = ref([]);
        const newComment = ref({ content: '', type: 'comment' });
        const myNotifications = ref([]);  // 存储我的通知（他人评论）
        const editingPlan = ref({});

        // 筛选
        const filterDepartment = ref('');
        const filterCategory = ref('');
        const filterStage = ref('');
        const searchKeyword = ref('');
        const searchKeywordTeam = ref('');

        // 可见性设置
        const newVisibility = ref({ owner_id: '', viewer_id: '' });

        // 修改密码
        const passwordForm = ref({ newPassword: '', confirmPassword: '' });
        const passwordError = ref('');
        const passwordSuccess = ref('');

        // 创建用户
        const newUser = ref({ email: '', name: '', department: '' });
        const creatingUser = ref(false);
        const createUserError = ref('');
        const createUserSuccess = ref('');

        // 代理导入
        const proxyImport = ref({ targetUserId: '' });
        const proxyImportResult = ref(null);


        // ===== 系统参数 =====
        const scopeOptions = ref(['业务主体', '中后台', 'HRC', 'ODC', 'FNC', 'DIC', 'AIC', '万马', '嘀嗒嘀', '斯贝斯', '恒洋如易', '靠谱', 'CCC', '其他']);
        const stageOptions = ref(['方法论--设计', '方法论--推广', '方法论--应用', '方法论--迭代', '方法论--审计', '常规支撑', '专项支撑', '其他规划']);
        const measurableOptions = ref(['可计量', '可感知']);
        const achievableOptions = ref(['一般', '容易', '困难']);
        const relevantOptions = ref(['业务-强关联', '业务-弱关联', '管理-强关联', '管理-弱关联', '个人-重点', '个人-一般', '其他']);
        const departmentOptions = ref(['ODC', 'HRC', 'FNC', 'DIC', 'AIC', 'FYA']);

        // 职能<管理三角>选项
        const categoryOptions = ref(['组织发展维度', '人力资源维度', '业务发展维度']);

        // 职能细分映射（改为 ref 以支持编辑）
        const subCategoryMap = ref({
            '组织发展维度': ['组织管理', '流程管理', '方法论管理', '异常管理'],
            '人力资源维度': ['招聘配置', '绩效管理', '员工关系'],
            '业务发展维度': []
        });

        // 当前选中的职能分类（用于管理职能细分）
        const selectedCategoryForSub = ref('组织发展维度');

        // 新增参数
        const newScopeOption = ref('');
        const newStageOption = ref('');
        const newMeasurableOption = ref('');
        const newAchievableOption = ref('');
        const newRelevantOption = ref('');
        const newCategoryOption = ref('');
        const newSubCategoryOption = ref('');

        // ===== 新计划表单 =====
        const newPlan = ref({
            category: '业务发展维度', sub_category: '', main_project: '', sub_project: '',
            description: '', scope: [], stage: '常规支撑', start_date: '', end_date: '',
            measurable: '可计量', achievable: '一般', relevant: '业务-强关联',
            owner: '', collaborators: '', progress: 0, notes: '', value_plan: '', value_review: ''
        });

        // ===== 计算属性 =====
        const isAdmin = computed(() => profile.value?.role === 'admin');
        const departments = computed(() => [...new Set(allProfiles.value.map(p => p.department).filter(Boolean))]);

        // 异常计划
        const exceptionPlans = computed(() => {
            return myPlans.value.filter(plan => {
                return getExceptionType(plan) !== '';
            });
        });

        // 筛选后的我的计划
        const filteredMyPlans = computed(() => {
            let plans = myPlans.value;
            if (filterCategory.value) plans = plans.filter(p => p.category === filterCategory.value);
            if (filterStage.value) plans = plans.filter(p => p.stage === filterStage.value);
            if (searchKeyword.value) {
                const keyword = searchKeyword.value.toLowerCase();
                plans = plans.filter(p => p.description?.toLowerCase().includes(keyword));
            }
            return plans;
        });

        // 筛选后的全部计划
        const filteredAllPlans = computed(() => {
            let plans = allPlans.value;
            if (filterDepartment.value) plans = plans.filter(p => p.department === filterDepartment.value);
            if (searchKeywordTeam.value) {
                const keyword = searchKeywordTeam.value.toLowerCase();
                plans = plans.filter(p => p.description?.toLowerCase().includes(keyword) || p.director_name?.toLowerCase().includes(keyword));
            }
            return plans;
        });

        // 绩效看板计算
        const avgProgress = computed(() => {
            if (myPlans.value.length === 0) return 0;
            const total = myPlans.value.reduce((sum, p) => sum + (p.progress || 0), 0);
            return Math.round(total / myPlans.value.length);
        });

        const onTimeRate = computed(() => {
            const completed = myPlans.value.filter(p => p.progress === 100);
            if (completed.length === 0) return 0;
            const onTime = completed.filter(p => {
                if (!p.end_date) return true;
                return new Date(p.updated_at || p.created_at) <= new Date(p.end_date);
            });
            return Math.round((onTime.length / completed.length) * 100);
        });

        const weeklyCompleted = computed(() => {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return myPlans.value.filter(p => {
                if (p.progress !== 100) return false;
                const updatedAt = new Date(p.updated_at || p.created_at);
                return updatedAt >= weekAgo;
            }).length;
        });

        // 通知看板 - 显示他人给我的评论
        const notifications = computed(() => {
            return myNotifications.value;
        });

        // ===== 方法 =====
        function getSubCategoryOptions(category) {
            return subCategoryMap.value[category] || [];
        }

        function onCategoryChange() {
            const options = subCategoryMap.value[newPlan.value.category];
            newPlan.value.sub_category = options?.length > 0 ? options[0] : '';
        }

        function resetNewPlan() {
            newPlan.value = {
                category: '业务发展维度', sub_category: '', main_project: '', sub_project: '',
                description: '', scope: [], stage: '常规支撑', start_date: '', end_date: '',
                measurable: '可计量', achievable: '一般', relevant: '业务-强关联',
                owner: '', collaborators: '', progress: 0, notes: '', value_plan: '', value_review: ''
            };
        }

        // 异常判断逻辑
        function getExceptionType(plan) {
            if (isOverdue(plan)) return 'delayed';
            if (isProgressSlow(plan)) return 'slow';
            return '';
        }

        function getExceptionLabel(plan) {
            if (isOverdue(plan)) return '进度延误';
            if (isProgressSlow(plan)) return '进度缓慢';
            return '';
        }

        function isOverdue(plan) {
            if (!plan.end_date || plan.progress >= 100) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endDate = new Date(plan.end_date);
            return today > endDate;
        }

        function isProgressSlow(plan) {
            if (!plan.start_date || !plan.end_date || plan.progress >= 100) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startDate = new Date(plan.start_date);
            const endDate = new Date(plan.end_date);
            if (today < startDate) return false;
            const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
            if (totalDays <= 0) return false;
            const elapsedDays = (today - startDate) / (1000 * 60 * 60 * 24);
            const timeProgress = elapsedDays / totalDays;
            return (plan.progress / 100) < timeProgress;
        }

        async function handleAuth() {
            authError.value = '';
            try {
                if (authMode.value === 'login') {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: authForm.value.email, password: authForm.value.password
                    });
                    if (error) throw error;
                    user.value = data.user;
                    await fetchProfile();
                } else {
                    const { data, error } = await supabaseClient.auth.signUp({
                        email: authForm.value.email, password: authForm.value.password,
                        options: { data: { name: authForm.value.name, department: authForm.value.department } }
                    });
                    if (error) throw error;
                    showRegisterSuccess.value = true;
                }
            } catch (error) {
                authError.value = error.message;
            }
        }

        function closeRegisterSuccess() {
            showRegisterSuccess.value = false;
            authMode.value = 'login';
            authForm.value = { email: '', password: '', name: '', department: '' };
        }

        async function handleLogout() {
            await supabaseClient.auth.signOut();
            user.value = null;
            profile.value = null;
            myPlans.value = [];
            allPlans.value = [];
        }

        async function fetchProfile() {
            const { data } = await supabaseClient.from('profiles').select('*').eq('id', user.value.id).single();
            if (data) profile.value = data;
        }

        async function fetchMyPlans() {
            const { data } = await supabaseClient.from('plans').select('*').eq('user_id', user.value.id).order('created_at', { ascending: false });
            if (data) myPlans.value = data;
        }

        async function fetchAllPlans() {
            const { data } = await supabaseClient.from('plans').select('*').order('created_at', { ascending: false });
            if (data) allPlans.value = data;
        }

        async function fetchAllProfiles() {
            const { data } = await supabaseClient.from('profiles').select('*');
            if (data) allProfiles.value = data;
        }

        async function fetchVisibilitySettings() {
            const { data } = await supabaseClient.from('visibility_settings').select('*');
            if (data) visibilitySettings.value = data;
        }

        // 获取他人给我的评论通知
        async function fetchMyNotifications() {
            // 获取我的所有计划ID
            const myPlanIds = myPlans.value.map(p => p.id);
            console.log('🔍 我的所有计划ID:', myPlanIds);

            if (myPlanIds.length === 0) {
                console.log('⚠️ 没有找到我的计划');
                myNotifications.value = [];
                return;
            }

            try {
                // 先尝试简单查询（不带关联）
                const { data: simpleData, error: simpleError } = await supabaseClient
                    .from('comments')
                    .select('*')
                    .in('plan_id', myPlanIds)
                    .order('created_at', { ascending: false })
                    .limit(10);

                console.log('📋 简单查询结果:', simpleData, simpleError);

                if (simpleError) {
                    console.error('获取通知失败:', simpleError);
                    return;
                }

                if (simpleData && simpleData.length > 0) {
                    // 获取所有评论者的用户ID
                    const commenterIds = [...new Set(simpleData.map(c => c.user_id))];
                    console.log('👥 评论者ID列表:', commenterIds);

                    // 查询这些用户的资料
                    const { data: profilesData, error: profilesError } = await supabaseClient
                        .from('profiles')
                        .select('id, name')
                        .in('id', commenterIds);

                    console.log('👤 用户资料:', profilesData, profilesError);

                    // 创建用户ID到名字的映射
                    const userMap = {};
                    if (profilesData) {
                        profilesData.forEach(p => {
                            userMap[p.id] = p.name;
                        });
                    }

                    // 过滤掉自己的评论，构建通知列表
                    myNotifications.value = simpleData
                        .filter(comment => comment.user_id !== user.value.id)
                        .map(comment => {
                            const plan = myPlans.value.find(p => p.id === comment.plan_id);
                            const commenterName = userMap[comment.user_id] || '有人';
                            return {
                                id: comment.id,
                                type: 'comment',
                                title: `${commenterName} 评论了您的任务`,
                                content: comment.content,
                                planDesc: plan?.description?.substring(0, 30) || '未知任务',
                                time: formatDate(comment.created_at)
                            };
                        });

                    console.log('✅ 最终通知列表:', myNotifications.value);
                } else {
                    console.log('📭 没有找到任何评论');
                    myNotifications.value = [];
                }
            } catch (err) {
                console.error('获取通知异常:', err);
            }
        }

        // 手动刷新通知
        async function refreshNotifications() {
            await fetchMyNotifications();
        }

        async function addPlan() {
            if (!newPlan.value.description) { alert('请填写任务描述'); return; }
            const planData = { ...newPlan.value, user_id: user.value.id, department: profile.value.department, director_name: profile.value.name };
            const { data, error } = await supabaseClient.from('plans').insert(planData).select().single();
            if (data) {
                myPlans.value.unshift(data);
                allPlans.value.unshift(data);
                resetNewPlan();
                showDrawer.value = false;
                alert('添加成功！');
            } else if (error) alert('添加失败：' + error.message);
        }

        function editPlan(plan) {
            editingPlan.value = { ...plan, scope: plan.scope || [] };
            showEditModal.value = true;
        }

        function viewPlanDetail(plan) {
            selectedPlan.value = plan;
            showDetailModal.value = true;
        }

        async function updatePlan() {
            const { data, error } = await supabaseClient.from('plans').update({
                category: editingPlan.value.category,
                sub_category: editingPlan.value.sub_category,
                main_project: editingPlan.value.main_project,
                sub_project: editingPlan.value.sub_project,
                description: editingPlan.value.description,
                stage: editingPlan.value.stage,
                start_date: editingPlan.value.start_date,
                end_date: editingPlan.value.end_date,
                measurable: editingPlan.value.measurable,
                achievable: editingPlan.value.achievable,
                relevant: editingPlan.value.relevant,
                owner: editingPlan.value.owner,
                collaborators: editingPlan.value.collaborators,
                progress: editingPlan.value.progress,
                notes: editingPlan.value.notes,
                value_plan: editingPlan.value.value_plan,
                value_review: editingPlan.value.value_review,
                updated_at: new Date().toISOString()
            }).eq('id', editingPlan.value.id).select().single();
            if (data) {
                const index = myPlans.value.findIndex(p => p.id === data.id);
                if (index > -1) myPlans.value[index] = data;
                const allIndex = allPlans.value.findIndex(p => p.id === data.id);
                if (allIndex > -1) allPlans.value[allIndex] = data;
                showEditModal.value = false;
                alert('更新成功！');
            } else if (error) alert('更新失败：' + error.message);
        }

        async function deletePlan(planId) {
            if (!confirm('确定要删除这条计划吗？')) return;
            const { error } = await supabaseClient.from('plans').delete().eq('id', planId);
            if (!error) {
                myPlans.value = myPlans.value.filter(p => p.id !== planId);
                allPlans.value = allPlans.value.filter(p => p.id !== planId);
                alert('删除成功！');
            } else alert('删除失败：' + error.message);
        }

        async function showComments(plan) {
            selectedPlan.value = plan;
            showCommentModal.value = true;
            const { data } = await supabaseClient.from('comments').select('*').eq('plan_id', plan.id).order('created_at', { ascending: true });
            if (data) planComments.value = data;
        }

        async function addComment() {
            if (!newComment.value.content.trim()) {
                alert('请输入评论内容');
                return;
            }
            const { data, error } = await supabaseClient.from('comments').insert({
                plan_id: selectedPlan.value.id,
                user_id: user.value.id,
                content: newComment.value.content,
                type: 'comment'  // 统一使用comment类型
            }).select().single();
            if (data) {
                planComments.value.push(data);
                newComment.value = { content: '', type: 'comment' };
                // 刷新通知
                await fetchMyNotifications();
            } else if (error) {
                console.error('评论失败:', error);
                alert('评论失败：' + error.message);
            }
        }

        // ===== 管理员功能 =====
        async function setAdmin(userId) {
            // 检查当前管理员数量
            const currentAdminCount = allProfiles.value.filter(p => p.role === 'admin').length;
            if (currentAdminCount >= 3) {
                alert('⚠️ 管理员数量已达上限（最多3个），无法添加更多管理员。');
                return;
            }

            const { error } = await supabaseClient.from('profiles').update({ role: 'admin' }).eq('id', userId);
            if (!error) { await fetchAllProfiles(); alert('✅ 设置成功！该用户已成为管理员。'); }
            else alert('设置失败：' + error.message);
        }

        async function removeAdmin(userId) {
            // 检查当前管理员数量
            const currentAdminCount = allProfiles.value.filter(p => p.role === 'admin').length;

            // 如果只有1个管理员，不能取消
            if (currentAdminCount <= 1) {
                alert('⚠️ 系统必须至少保留1个管理员，无法取消。');
                return;
            }

            // 如果取消的是自己，需要确认
            if (userId === user.value.id) {
                const confirmed = confirm('⚠️ 您确定要取消自己的管理员身份吗？\n\n取消后您将失去管理员权限，无法再访问管理功能。');
                if (!confirmed) return;
            }

            const { error } = await supabaseClient.from('profiles').update({ role: 'user' }).eq('id', userId);
            if (!error) { await fetchAllProfiles(); alert('✅ 已取消该用户的管理员身份。'); }
            else alert('取消失败：' + error.message);
        }

        // 检查是否可以设置管理员
        function canSetAdmin() {
            const currentAdminCount = allProfiles.value.filter(p => p.role === 'admin').length;
            return currentAdminCount < 3;
        }

        // 检查是否可以取消管理员
        function canRemoveAdmin(profileId) {
            const currentAdminCount = allProfiles.value.filter(p => p.role === 'admin').length;
            // 如果只有1个管理员，不能取消任何人的管理员身份
            if (currentAdminCount <= 1) return false;
            return true;
        }

        // 获取当前管理员数量
        function getAdminCount() {
            return allProfiles.value.filter(p => p.role === 'admin').length;
        }

        async function addVisibilitySetting() {
            if (!newVisibility.value.owner_id || !newVisibility.value.viewer_id) {
                alert('请选择计划拥有者和可见者');
                return;
            }
            const { data, error } = await supabaseClient.from('visibility_settings')
                .insert({ owner_id: newVisibility.value.owner_id, viewer_id: newVisibility.value.viewer_id, can_view: true })
                .select().single();
            if (data) {
                visibilitySettings.value.push(data);
                newVisibility.value = { owner_id: '', viewer_id: '' };
            } else alert('添加失败：' + error.message);
        }

        async function updateVisibility(setting) {
            await supabaseClient.from('visibility_settings').update({ can_view: setting.can_view }).eq('id', setting.id);
        }

        async function deleteVisibilitySetting(settingId) {
            const { error } = await supabaseClient.from('visibility_settings').delete().eq('id', settingId);
            if (!error) visibilitySettings.value = visibilitySettings.value.filter(s => s.id !== settingId);
        }

        // ===== 修改密码 =====
        async function changePassword() {
            passwordError.value = '';
            passwordSuccess.value = '';

            if (passwordForm.value.newPassword.length < 6) {
                passwordError.value = '密码长度至少6位';
                return;
            }

            if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
                passwordError.value = '两次输入的密码不一致';
                return;
            }

            const { error } = await supabaseClient.auth.updateUser({
                password: passwordForm.value.newPassword
            });

            if (error) {
                passwordError.value = error.message;
            } else {
                passwordSuccess.value = '密码修改成功！';
                passwordForm.value = { newPassword: '', confirmPassword: '' };
            }
        }

        // ===== 创建用户 =====
        async function createUser() {
            createUserError.value = '';
            createUserSuccess.value = '';

            if (!newUser.value.email || !newUser.value.name || !newUser.value.department) {
                createUserError.value = '请填写完整信息';
                return;
            }

            creatingUser.value = true;

            try {
                const tempPassword = generateTempPassword();

                const { data, error } = await supabaseClient.auth.signUp({
                    email: newUser.value.email,
                    password: tempPassword,
                    options: {
                        data: { name: newUser.value.name, department: newUser.value.department },
                        emailRedirectTo: window.location.origin
                    }
                });

                if (error) {
                    createUserError.value = error.message;
                    creatingUser.value = false;
                    return;
                }

                await supabaseClient.auth.resetPasswordForEmail(newUser.value.email, {
                    redirectTo: window.location.origin
                });

                createUserSuccess.value = `用户创建成功！已向 ${newUser.value.email} 发送激活邮件。`;
                newUser.value = { email: '', name: '', department: '' };

                setTimeout(() => { fetchAllProfiles(); }, 1000);

            } catch (err) {
                createUserError.value = '创建失败：' + err.message;
            }

            creatingUser.value = false;
        }

        function generateTempPassword() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
            let password = '';
            for (let i = 0; i < 12; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return password;
        }

        // ===== 代理导入 =====
        async function handleProxyImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            if (!proxyImport.value.targetUserId) {
                proxyImportResult.value = { success: false, message: '请先选择目标用户' };
                event.target.value = '';
                return;
            }

            const targetProfile = allProfiles.value.find(p => p.id === proxyImport.value.targetUserId);
            if (!targetProfile) {
                proxyImportResult.value = { success: false, message: '找不到目标用户' };
                event.target.value = '';
                return;
            }

            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const parseDate = (dateValue) => {
                    if (!dateValue) return null;
                    if (typeof dateValue === 'number') {
                        const date = new Date((dateValue - 25569) * 86400 * 1000);
                        return date.toISOString().split('T')[0];
                    }
                    if (typeof dateValue === 'string') {
                        const cleaned = dateValue.trim();
                        if (!cleaned) return null;
                        const date = new Date(cleaned);
                        if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
                    }
                    return null;
                };

                const parseProgress = (value) => {
                    if (!value) return 0;
                    if (typeof value === 'number') return Math.min(100, Math.max(0, Math.round(value * 100)));
                    if (typeof value === 'string') {
                        const num = parseFloat(value);
                        if (!isNaN(num)) return num <= 1 ? Math.round(num * 100) : Math.min(100, Math.max(0, Math.round(num)));
                    }
                    return 0;
                };

                let importCount = 0;
                let errorCount = 0;

                for (const row of jsonData) {
                    const description = row['任务描述'] || row['描述'] || '';
                    if (!description.trim()) continue;

                    const planData = {
                        user_id: proxyImport.value.targetUserId,
                        department: targetProfile.department,
                        director_name: targetProfile.name,
                        category: row['职能<管理三角>'] || row['职能分类'] || '业务发展维度',
                        sub_category: row['职能细分'] || '',
                        main_project: row['主项目名称'] || row['主项目'] || '',
                        sub_project: row['子项目名称'] || row['子项目'] || '',
                        description: description,
                        scope: row['覆盖范围'] ? row['覆盖范围'].toString().split(/[,，]/).map(s => s.trim()).filter(s => s) : [],
                        stage: row['任务阶段'] || '常规支撑',
                        start_date: parseDate(row['开始日期'] || row['预计开始时间']),
                        end_date: parseDate(row['结束日期'] || row['预计结束时间']),
                        measurable: row['可衡量(M)'] || row['可衡量'] || '可计量',
                        achievable: row['可实现(A)'] || row['可实现'] || '一般',
                        relevant: row['相关性(R)'] || row['相关性'] || '业务-强关联',
                        owner: row['负责人'] || '',
                        collaborators: row['协同人'] || '',
                        progress: parseProgress(row['当下进度'] || row['进度']),
                        notes: row['备注'] || '',
                        value_plan: row['价值计划'] || '',
                        value_review: row['价值评价'] || ''
                    };

                    const { data: result, error } = await supabaseClient.from('plans').insert(planData).select().single();
                    if (result) { allPlans.value.unshift(result); importCount++; }
                    else { console.error('导入失败:', error); errorCount++; }
                }

                event.target.value = '';
                proxyImportResult.value = errorCount > 0
                    ? { success: true, message: `导入完成！成功 ${importCount} 条，失败 ${errorCount} 条` }
                    : { success: true, message: `成功为 ${targetProfile.name} 导入 ${importCount} 条计划！` };

            } catch (error) {
                console.error('导入错误:', error);
                proxyImportResult.value = { success: false, message: '导入失败：' + error.message };
            }
        }

        // ===== 下载模板 =====
        function downloadTemplate() {
            const templateData = [
                {
                    '职能<管理三角>': '业务发展维度',
                    '职能细分': '财务管理',
                    '主项目名称': '1.预算与预测体系',
                    '子项目名称': '现金流预测',
                    '任务描述': '建立滚动预测模型，确保月度公司级与业务线战略目标与预算偏差≤10%',
                    '覆盖范围': '业务主体,中后台',
                    '任务阶段': '常规支撑',
                    '开始日期': '2026-03-01',
                    '结束日期': '2026-06-30',
                    '可衡量(M)': '可计量',
                    '可实现(A)': '一般',
                    '相关性(R)': '业务-强关联',
                    '负责人': '张三',
                    '协同人': '李四,王五',
                    '当下进度': 0,
                    '备注': '示例备注',
                    '价值计划': '提升财务可视性与控制力',
                    '价值评价': ''
                }
            ];

            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '年度计划模板');

            const colWidths = [
                { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 40 },
                { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
                { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 10 },
                { wch: 20 }, { wch: 20 }, { wch: 20 }
            ];
            worksheet['!cols'] = colWidths;

            XLSX.writeFile(workbook, '年度计划导入模板.xlsx');
        }

        // ===== Excel 导入（自己） =====
        async function handleFileImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const parseDate = (dateValue) => {
                    if (!dateValue) return null;
                    if (typeof dateValue === 'number') {
                        const date = new Date((dateValue - 25569) * 86400 * 1000);
                        return date.toISOString().split('T')[0];
                    }
                    if (typeof dateValue === 'string') {
                        const cleaned = dateValue.trim();
                        if (!cleaned) return null;
                        const date = new Date(cleaned);
                        if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
                    }
                    return null;
                };

                const parseProgress = (value) => {
                    if (!value) return 0;
                    if (typeof value === 'number') return Math.min(100, Math.max(0, Math.round(value * 100)));
                    if (typeof value === 'string') {
                        const num = parseFloat(value);
                        if (!isNaN(num)) return num <= 1 ? Math.round(num * 100) : Math.min(100, Math.max(0, Math.round(num)));
                    }
                    return 0;
                };

                let importCount = 0;
                let errorCount = 0;

                for (const row of jsonData) {
                    const description = row['任务描述'] || row['描述'] || '';
                    if (!description.trim()) continue;

                    const planData = {
                        user_id: user.value.id,
                        department: profile.value.department,
                        director_name: profile.value.name,
                        category: row['职能<管理三角>'] || row['职能分类'] || '业务发展维度',
                        sub_category: row['职能细分'] || '',
                        main_project: row['主项目名称'] || row['主项目'] || '',
                        sub_project: row['子项目名称'] || row['子项目'] || '',
                        description: description,
                        scope: row['覆盖范围'] ? row['覆盖范围'].toString().split(/[,，]/).map(s => s.trim()).filter(s => s) : [],
                        stage: row['任务阶段'] || '常规支撑',
                        start_date: parseDate(row['开始日期'] || row['预计开始时间']),
                        end_date: parseDate(row['结束日期'] || row['预计结束时间']),
                        measurable: row['可衡量(M)'] || row['可衡量'] || '可计量',
                        achievable: row['可实现(A)'] || row['可实现'] || '一般',
                        relevant: row['相关性(R)'] || row['相关性'] || '业务-强关联',
                        owner: row['负责人'] || '',
                        collaborators: row['协同人'] || '',
                        progress: parseProgress(row['当下进度'] || row['进度']),
                        notes: row['备注'] || '',
                        value_plan: row['价值计划'] || '',
                        value_review: row['价值评价'] || ''
                    };

                    const { data: result, error } = await supabaseClient.from('plans').insert(planData).select().single();
                    if (result) { myPlans.value.unshift(result); allPlans.value.unshift(result); importCount++; }
                    else { console.error('导入失败:', error); errorCount++; }
                }

                event.target.value = '';
                alert(errorCount > 0 ? `导入完成！成功 ${importCount} 条，失败 ${errorCount} 条` : `成功导入 ${importCount} 条计划！`);

            } catch (error) {
                console.error('导入错误:', error);
                alert('导入失败：' + error.message);
            }
        }

        // ===== 系统参数管理 =====
        function addScopeOption() {
            if (newScopeOption.value && !scopeOptions.value.includes(newScopeOption.value)) {
                scopeOptions.value.push(newScopeOption.value);
                newScopeOption.value = '';
            }
        }

        function removeScopeOption(index) {
            scopeOptions.value.splice(index, 1);
        }

        function addStageOption() {
            if (newStageOption.value && !stageOptions.value.includes(newStageOption.value)) {
                stageOptions.value.push(newStageOption.value);
                newStageOption.value = '';
            }
        }

        function removeStageOption(index) {
            stageOptions.value.splice(index, 1);
        }

        function addMeasurableOption() {
            if (newMeasurableOption.value && !measurableOptions.value.includes(newMeasurableOption.value)) {
                measurableOptions.value.push(newMeasurableOption.value);
                newMeasurableOption.value = '';
            }
        }

        // 可实现(A)选项管理
        function addAchievableOption() {
            if (newAchievableOption.value && !achievableOptions.value.includes(newAchievableOption.value)) {
                achievableOptions.value.push(newAchievableOption.value);
                newAchievableOption.value = '';
            }
        }

        function removeAchievableOption(index) {
            achievableOptions.value.splice(index, 1);
        }

        // 相关性(R)选项管理
        function addRelevantOption() {
            if (newRelevantOption.value && !relevantOptions.value.includes(newRelevantOption.value)) {
                relevantOptions.value.push(newRelevantOption.value);
                newRelevantOption.value = '';
            }
        }

        function removeRelevantOption(index) {
            relevantOptions.value.splice(index, 1);
        }

        // 职能<管理三角>选项管理
        function addCategoryOption() {
            if (newCategoryOption.value && !categoryOptions.value.includes(newCategoryOption.value)) {
                categoryOptions.value.push(newCategoryOption.value);
                subCategoryMap.value[newCategoryOption.value] = []; // 初始化空数组
                newCategoryOption.value = '';
            }
        }

        function removeCategoryOption(index) {
            const category = categoryOptions.value[index];
            categoryOptions.value.splice(index, 1);
            delete subCategoryMap.value[category];
            // 如果删除的是当前选中的，切换到第一个
            if (selectedCategoryForSub.value === category && categoryOptions.value.length > 0) {
                selectedCategoryForSub.value = categoryOptions.value[0];
            }
        }

        // 职能细分选项管理
        function addSubCategoryOption() {
            const currentCategory = selectedCategoryForSub.value;
            if (newSubCategoryOption.value && !subCategoryMap.value[currentCategory].includes(newSubCategoryOption.value)) {
                subCategoryMap.value[currentCategory].push(newSubCategoryOption.value);
                newSubCategoryOption.value = '';
            }
        }

        function removeSubCategoryOption(index) {
            subCategoryMap.value[selectedCategoryForSub.value].splice(index, 1);
        }

        // 获取当前选中分类的职能细分列表
        function getCurrentSubCategories() {
            return subCategoryMap.value[selectedCategoryForSub.value] || [];
        }

        function getUserName(userId) {
            const p = allProfiles.value.find(p => p.id === userId);
            return p?.name || '未知用户';
        }

        function formatDate(dateStr) {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        }

        // ===== 监听视图切换 =====
        watch(currentView, async (newView) => {
            // 切换到驾驶舱时刷新通知
            if (newView === 'dashboard') {
                await fetchMyNotifications();
            }
        });

        // ===== 生命周期 =====
        onMounted(async () => {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session?.user) {
                user.value = session.user;
                await fetchProfile();
                await fetchMyPlans();
                await fetchAllPlans();
                await fetchAllProfiles();
                await fetchMyNotifications();  // 获取通知
                if (isAdmin.value) await fetchVisibilitySettings();
            }

            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session?.user) {
                    user.value = session.user;
                    await fetchProfile();
                    await fetchMyPlans();
                    await fetchAllPlans();
                    await fetchAllProfiles();
                    await fetchMyNotifications();  // 获取通知
                    if (isAdmin.value) await fetchVisibilitySettings();
                } else if (event === 'SIGNED_OUT') {
                    user.value = null; profile.value = null; myPlans.value = []; allPlans.value = []; myNotifications.value = [];
                }
            });
            loading.value = false;
        });

        return {
            loading, user, profile, authMode, authForm, authError, currentView, myPlans, allPlans,
            visibilitySettings, allProfiles, showCommentModal, showEditModal, showDetailModal,
            showRegisterSuccess, selectedPlan, planComments, newComment, editingPlan, filterDepartment, searchKeyword, newPlan,
            newVisibility, isAdmin, departments, filteredAllPlans,
            onCategoryChange, resetNewPlan, handleAuth, handleLogout, addPlan, editPlan, updatePlan,
            deletePlan, showComments, addComment, viewPlanDetail, handleFileImport, downloadTemplate,
            setAdmin, removeAdmin, addVisibilitySetting, updateVisibility, deleteVisibilitySetting,
            canSetAdmin, canRemoveAdmin, getAdminCount,
            getUserName, formatDate, closeRegisterSuccess,
            // v2.0 新增
            sidebarCollapsed, showDrawer, settingsTab, exceptionPlans, filteredMyPlans,
            filterCategory, filterStage, searchKeywordTeam, scopeOptions, stageOptions, measurableOptions, departmentOptions,
            getSubCategoryOptions, getExceptionType, getExceptionLabel,
            // 绩效看板
            avgProgress, onTimeRate, weeklyCompleted,
            // 通知看板
            notifications, myNotifications, refreshNotifications,
            // 参数管理
            newScopeOption, newStageOption, newMeasurableOption,
            addScopeOption, removeScopeOption, addStageOption, removeStageOption, addMeasurableOption,
            // 新增参数管理
            achievableOptions, relevantOptions, categoryOptions, subCategoryMap,
            selectedCategoryForSub, newAchievableOption, newRelevantOption, newCategoryOption, newSubCategoryOption,
            addAchievableOption, removeAchievableOption, addRelevantOption, removeRelevantOption,
            addCategoryOption, removeCategoryOption, addSubCategoryOption, removeSubCategoryOption, getCurrentSubCategories,
            // 密码
            passwordForm, passwordError, passwordSuccess, changePassword,
            // 创建用户
            newUser, creatingUser, createUserError, createUserSuccess, createUser,
            // 代理导入
            proxyImport, proxyImportResult, handleProxyImport
        };
    }
}).mount('#app');
