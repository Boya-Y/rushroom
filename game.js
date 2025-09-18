// 自走棋游戏主逻辑（优化版 v2：修复飘字战场与即时合成）
class AutoChessGame {
    constructor() {
        this.gameState = {
            round: 1,
            gold: GameConfig.gameSettings.initialGold,
            health: GameConfig.gameSettings.initialHealth,
            playerUnits: new Map(), // 玩家单位 {position: unit}
            enemyUnits: new Map(),  // 敌方单位 {position: unit}
            shop: [],               // 商店单位
            inventory: new Map(),   // 背包中的单位 {unitId: count_1star}
            inBattle: false,
            winStreak: 0
        };
        
        this.draggedUnit = null;
        this.draggedFrom = null;
        
        // 点击布阵/卡牌点位模式状态
        this.selectedCellIndex = null;     // 当前选中的我方格位用于换位
        this.selectedShopIndex = null;     // 当前选中的商店卡牌用于点位落子
        
        this.init();
    }
    
    init() {
        this.createGrids();
        // 回合开始的商店应免费刷新一次
        this.refreshShop(true);
        this.updateUI();
        this.bindEvents();
        // 平时不显示“重新开始”按钮，避免误触
        this.showNormalControls();
        this.generateEnemyUnits();
        // 首屏：渲染战场（敌方与我方）
        this.renderPlayerField();
        this.renderEnemyField();

        // 根据设备方向/宽度应用布局（竖屏：敌上己下）
        this.applyResponsiveLayout();
        window.addEventListener('resize', () => this.applyResponsiveLayout());
        window.addEventListener('orientationchange', () => this.applyResponsiveLayout());
    }
    
    // ========== 战场 & UI ==========
    createGrids() {
        const playerGrid = document.getElementById('player-grid');
        const enemyGrid = document.getElementById('enemy-grid');
        
        for (let i = 0; i < 16; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.position = i;
            cell.style.position = 'relative'; // 让飘字能以格子为定位参照
            cell.addEventListener('dragover', this.handleDragOver.bind(this));
            cell.addEventListener('drop', this.handleDrop.bind(this));
            // 点击布阵：点击选择 → 点击目标格
            cell.addEventListener('click', (e) => this.handleCellClick(e));
            playerGrid.appendChild(cell);
        }
        
        for (let i = 0; i < 16; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell enemy';
            cell.dataset.position = i;
            cell.style.position = 'relative';
            enemyGrid.appendChild(cell);
        }
    }
    
    updateUI() {
        document.getElementById('round').textContent = this.gameState.round;
        document.getElementById('gold').textContent = this.gameState.gold;
        document.getElementById('health').textContent = this.gameState.health;
    }

    // 布局判断：当设备为纵向或屏幕窄于700px时，视为竖屏布局
    isPortraitLayout() {
        return window.matchMedia('(orientation: portrait)').matches || window.innerWidth <= 700 || window.innerHeight > window.innerWidth;
    }

    // 应用响应式布局：切换 body 的 portrait-mode 类
    applyResponsiveLayout() {
        const isPortrait = this.isPortraitLayout();
        document.body.classList.toggle('portrait-mode', isPortrait);
    }

    // 实际视图状态（以 CSS 类为准），避免 JS 与样式判断不一致
    isPortraitView() {
        return document.body.classList.contains('portrait-mode');
    }

    // 最权威的布局判断：读取 .battlefield-container 的实际 flex-direction
    isVerticalStackedLayout() {
        const container = document.querySelector('.battlefield-container');
        if (container) {
            const dir = window.getComputedStyle(container).flexDirection;
            if (dir && dir.startsWith('column')) return true; // 包含 column 与 column-reverse
        }
        // 兜底：退回到类/窗口判断
        return this.isPortraitView() || this.isPortraitLayout();
    }

    // 控件显示：正常状态（显示刷新/开战，隐藏重开）
    showNormalControls() {
        const refreshBtn = document.getElementById('refresh-shop');
        const startBtn = document.getElementById('start-battle');
        const restartBtn = document.getElementById('restart-game-btn');
        if (refreshBtn) refreshBtn.style.display = '';
        if (startBtn) startBtn.style.display = '';
        if (restartBtn) restartBtn.style.display = 'none';
    }

    // 控件显示：失败状态（隐藏刷新/开战，仅显示重开）
    showDefeatControls() {
        const refreshBtn = document.getElementById('refresh-shop');
        const startBtn = document.getElementById('start-battle');
        const restartBtn = document.getElementById('restart-game-btn');
        if (refreshBtn) refreshBtn.style.display = 'none';
        if (startBtn) startBtn.style.display = 'none';
        if (restartBtn) restartBtn.style.display = '';
    }
    
    logMessage(message) {
        const logContent = document.getElementById('log-content');
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;
    }
    
    // ========== 商店 ==========
    refreshShop(free = false) {
        const cost = GameConfig.gameSettings.shopRefreshCost;
        if (!free && this.gameState.gold < cost) {
            this.logMessage('金币不足，无法刷新商店');
            return;
        }
        
        // 刷新时清除卡牌选择
        this.selectedShopIndex = null;
        
        this.gameState.shop = [];
        for (let i = 0; i < GameConfig.gameSettings.shopSize; i++) {
            const unitId = ConfigUtils.getRandomUnitId();
            const cost = ConfigUtils.getUnitCost(unitId);
            this.gameState.shop.push({ id: unitId, cost });
        }
        if (!free) {
            this.gameState.gold -= GameConfig.gameSettings.shopRefreshCost;
        }
        this.renderShop();
        this.updateUI();
    }

    renderShop() {
        const shopContainer = document.getElementById('shop');
        shopContainer.innerHTML = '';
        
        this.gameState.shop.forEach((unit, index) => {
            const affordable = ConfigUtils.canAffordUnit(unit.id, this.gameState.gold);
            const unitName = ConfigUtils.getUnitName(unit.id);
            const rarity = ConfigUtils.getUnitRarity(unit.id);
            const statsPreview = ConfigUtils.calculateUnitStats(unit.id, 1); // 商店展示1星属性
            const unitElement = document.createElement('div');
            unitElement.className = 'shop-unit';
            if (affordable) unitElement.classList.add('affordable');
            else unitElement.classList.add('expensive');
            if (this.selectedShopIndex === index) unitElement.classList.add('selected');
            
            // 使用与战场相同的单位形象
            const previewUnit = {
                id: unit.id,
                position: 0,
                star: 1,
                name: statsPreview.name ?? unitName,
                icon: statsPreview.icon ?? '',
                attack: statsPreview.attack,
                health: statsPreview.health,
                maxHealth: statsPreview.maxHealth ?? statsPreview.health,
                type: statsPreview.type,
                healPower: statsPreview.healPower || 0
            };
            const unitCard = this.createUnitElement(previewUnit, true); // 传 true 以禁用拖拽事件
            unitElement.appendChild(unitCard);

            // 简单显示费用
            const costBadge = document.createElement('div');
            costBadge.className = 'shop-unit-cost';
            costBadge.textContent = `${unit.cost}`;
            unitElement.appendChild(costBadge);
            
            unitElement.addEventListener('click', () => {
                if (this.isTouchDevice()) {
                    this.onShopUnitClick(index);
                } else {
                    this.buyUnit(index);
                }
            });
            shopContainer.appendChild(unitElement);
        });
    }
    
    // 购买单位（修复：点击第三个立即合成，商店立刻消失，战场即时升级）
    buyUnit(shopIndex) {
        const unit = this.gameState.shop[shopIndex];
        if (!unit || !ConfigUtils.canAffordUnit(unit.id, this.gameState.gold)) {
            return false;
        }

        const unitId = unit.id;

        // 扣费 + 移除商店 + 立即重绘商店（保证点击后马上从UI消失）
        this.gameState.gold -= unit.cost;
        this.gameState.shop.splice(shopIndex, 1);
        this.renderShop();
        this.updateUI();

        // 扩展规则：
        // - 当场上已有同名2星×2 且 1星×2 时，这次购买直接以上场为3星（不删除其他单位）
        // - 否则若场上已有同名1星×2，则这次购买直接以上场为2星（不删除其他单位）
        // - 其他情况按1星上场
        const count1 = this.getFieldUnitsByIdAndStar(unitId, 1).length;
        const count2 = this.getFieldUnitsByIdAndStar(unitId, 2).length;
        let starToPlace = 1;
        if (count2 >= 2 && count1 >= 2) {
            starToPlace = 3;
        } else if (count1 >= 2) {
            starToPlace = 2;
        }

        // 先尝试把单位以上述星级上到场上（若满则进背包）
        const placedPos = this.addUnitToField(unitId, starToPlace);
        if (placedPos == null) {
            const inv = this.gameState.inventory.get(unitId) || 0;
            this.gameState.inventory.set(unitId, inv + 1);
        } else {
            // 最后一步（你当前要求）：如果本次是高星落位（≥2星），删除场上除此新单位外的所有同名单位
            if (starToPlace > 1) {
                const toRemove = [];
                for (const [pos, u] of this.gameState.playerUnits) {
                    if (u.id === unitId && pos !== placedPos) {
                        toRemove.push(pos);
                    }
                }
                for (const pos of toRemove) {
                    this.gameState.playerUnits.delete(pos);
                }
            }
        }

        // 渲染与UI刷新
        this.renderPlayerField();
        this.updateUI();
        return true;
    }
    
    // ========== 上场 & 合成 ==========
    addUnitToField(unitId, star) {
        for (let i = 0; i < 16; i++) {
            if (!this.gameState.playerUnits.has(i)) {
                const stats = ConfigUtils.calculateUnitStats(unitId, star);
                const unit = {
                    id: unitId,
                    position: i,
                    star: star,
                    name: stats.name ?? ConfigUtils.getUnitName(unitId),
                    icon: stats.icon ?? '',
                    attack: stats.attack,
                    health: stats.health,
                    maxHealth: stats.maxHealth ?? stats.health,
                    type: stats.type,
                    healPower: stats.healPower || 0
                };
                this.gameState.playerUnits.set(i, unit);
                return i; // 返回新单位的落位位置
            }
        }
        return null; // 没有空位
    }
    
    getFieldUnitsByIdAndStar(unitId, star) {
        const list = [];
        for (const [pos, u] of this.gameState.playerUnits) {
            if (u.id === unitId && u.star === star) list.push({ pos, u });
        }
        return list;
    }
    
    // 核心：直接把“新买的一枚 + 背包 + 场上”凑成3合1（即刻合成2星）
    attemptImmediateMerge(unitId, incomingCount = 0) {
        // 仅处理1→2星即时合成；更高星链式由 checkAutoMergeChain 处理（场上）
        let inv = this.gameState.inventory.get(unitId) || 0;
        const field1 = this.getFieldUnitsByIdAndStar(unitId, 1); // 场上1星数量
        
        const totalPool = inv + incomingCount + field1.length;
        if (totalPool < 3) return false;
        
        // 需要消耗3枚1星：尽量先用背包（包含新买的），不够再用场上
        const useFromInventory = Math.min(3, inv + incomingCount);
        let useFromField = 3 - useFromInventory;
        if (useFromField > field1.length) {
            useFromField = field1.length;
        }
        
        const newInv = inv + incomingCount - useFromInventory;
        this.gameState.inventory.set(unitId, newInv);
        
        let targetPosForNew = null;
        for (let i = 0; i < useFromField; i++) {
            const { pos } = field1[i];
            if (targetPosForNew == null) targetPosForNew = pos; // 升级单位落位在第一枚被移除的位置
            this.gameState.playerUnits.delete(pos);
        }
        
        if (targetPosForNew == null) {
            for (let i = 0; i < 16; i++) {
                if (!this.gameState.playerUnits.has(i)) {
                    targetPosForNew = i;
                    break;
                }
            }
        }
        
        const stats2 = ConfigUtils.calculateUnitStats(unitId, 2);
        if (targetPosForNew != null) {
            this.gameState.playerUnits.set(targetPosForNew, {
                id: unitId,
                position: targetPosForNew,
                star: 2,
                name: stats2.name ?? ConfigUtils.getUnitName(unitId),
                icon: stats2.icon ?? '',
                attack: stats2.attack,
                health: stats2.health,
                maxHealth: stats2.maxHealth ?? stats2.health,
                type: stats2.type,
                healPower: stats2.healPower || 0
            });
            this.logMessage(`${ConfigUtils.getUnitName(unitId)} 合成为 2 星！`);
            
            // 继续做链式合成（例如3个2星→3星），仅场上检查
            this.checkAutoMergeChain(unitId);
            
            // 确保UI立刻刷新，显示升级后的单位
            this.renderPlayerField();
            this.updateUI();
        } else {
            const rollback = (this.gameState.inventory.get(unitId) || 0) + 3;
            this.gameState.inventory.set(unitId, rollback);
            this.logMessage(`没有空位放置 2 星，已将3枚1星退回背包（建议实现带星级的背包以支持高级情况）`);
            return false;
        }
        
        return true;
    }
    
    // 场上链式合成（1→2，2→3），返回是否发生至少一次合成
    checkAutoMerge(unitId, star) {
        if (star >= 3) return false;
        const same = this.getFieldUnitsByIdAndStar(unitId, star);
        if (same.length >= 3) {
            const keep = same[0];
            const newStar = star + 1;
            const upgraded = ConfigUtils.calculateUnitStats(unitId, newStar);
            
            keep.u.star = newStar;
            keep.u.attack = upgraded.attack;
            keep.u.health = upgraded.health;
            keep.u.maxHealth = upgraded.maxHealth ?? upgraded.health;
            keep.u.name = keep.u.name ?? upgraded.name ?? ConfigUtils.getUnitName(unitId);
            keep.u.icon = keep.u.icon ?? upgraded.icon ?? '';
            keep.u.type = upgraded.type;
            keep.u.healPower = upgraded.healPower || 0;
            
            this.gameState.playerUnits.delete(same[1].pos);
            this.gameState.playerUnits.delete(same[2].pos);
            this.logMessage(`${ConfigUtils.getUnitName(unitId)} 合成为 ${newStar} 星！`);
            return true;
        }
        return false;
    }
    
    checkAutoMergeChain(unitId) {
        let merged = false;
        for (let star = 1; star <= 2; star++) {
            if (this.checkAutoMerge(unitId, star)) merged = true;
        }
        if (merged) {
            // 若发生了任意一次合成，先立即渲染一次
            this.renderPlayerField();
            this.updateUI();
            // 然后继续递归直到不能再合成
            this.checkAutoMergeChain(unitId);
        }
    }
    
    // ========== 渲染战场 ==========
    renderPlayerField() {
        const playerGrid = document.getElementById('player-grid');
        const cells = playerGrid.querySelectorAll('.grid-cell');
        
        cells.forEach((cell, index) => {
            cell.innerHTML = '';
            cell.className = 'grid-cell';
            cell.style.position = 'relative';
            
            const unit = this.gameState.playerUnits.get(index);
            if (unit && unit.health > 0) {
                cell.classList.add('occupied');
                const unitElement = this.createUnitElement(unit);
                cell.appendChild(unitElement);
            }
        });
    }
    
    renderEnemyField() {
        const enemyGrid = document.getElementById('enemy-grid');
        const cells = enemyGrid.querySelectorAll('.grid-cell');
        
        cells.forEach((cell, index) => {
            cell.innerHTML = '';
            cell.className = 'grid-cell enemy';
            cell.style.position = 'relative';
            
            const unit = this.gameState.enemyUnits.get(index);
            if (unit && unit.health > 0) {
                cell.classList.add('occupied');
                const unitElement = this.createUnitElement(unit, true);
                cell.appendChild(unitElement);
            }
        });
    }
    
    createUnitElement(unit, isEnemy = false) {
        const unitElement = document.createElement('div');
        unitElement.className = `unit unit-${unit.star}-star`;
        unitElement.draggable = !isEnemy;
        
        if (!isEnemy) {
            unitElement.addEventListener('dragstart', this.handleDragStart.bind(this));
        }
        
        const stars = '★'.repeat(unit.star);
        unitElement.innerHTML = `
            <div class="unit-stars">${stars}</div>
            <div class="unit-icon">${unit.icon ?? ''}</div>
            <div class="unit-name">${unit.name ?? ''}</div>
            <div class="unit-stats">
                <span class="unit-attack">${unit.attack}</span>
                <div class="unit-health-number">
                    <div class="health-text">${unit.health}</div>
                </div>
            </div>
        `;
        
        return unitElement;
    }
    
    // ========== 拖拽 ==========
    handleDragStart(e) {
        const cell = e.target.closest('.grid-cell');
        if (!cell) return;
        const position = parseInt(cell.dataset.position);
        this.draggedUnit = this.gameState.playerUnits.get(position);
        this.draggedFrom = position;
        e.target.classList.add('dragging');
    }
    
    handleDragOver(e) {
        e.preventDefault();
    }
    
    handleDrop(e) {
        e.preventDefault();
        if (!this.draggedUnit) return;
        
        const cell = e.target.closest('.grid-cell');
        if (!cell) return;
        const newPosition = parseInt(cell.dataset.position);
        
        const existingUnit = this.gameState.playerUnits.get(newPosition);
        
        // 记录被拖拽单位ID，用于合成检查
        const movedUnitId = this.draggedUnit.id;
        
        this.gameState.playerUnits.delete(this.draggedFrom);
        this.gameState.playerUnits.set(newPosition, {
            ...this.draggedUnit,
            position: newPosition
        });
        
        if (existingUnit) {
            this.gameState.playerUnits.set(this.draggedFrom, {
                ...existingUnit,
                position: this.draggedFrom
            });
        }
        
        // 拖拽落位后检查是否触发动作为合成（包含1->2、2->3的链式合成）
        this.checkAutoMergeChain(movedUnitId);
        
        this.draggedUnit = null;
        this.draggedFrom = null;
        
        this.renderPlayerField();
        this.updateUI();
    }
    
    // ========== 敌方生成 ==========

    // 设备判定：触屏
    isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    }

    // 触屏：点击商店卡牌，进入选择/取消状态
    onShopUnitClick(index) {
        if (this.gameState.inBattle) return;
        if (this.selectedShopIndex === index) {
            this.selectedShopIndex = null;
            this.renderShop();
            this.logMessage('已取消卡牌选择');
            return;
        }
        const unit = this.gameState.shop[index];
        if (!unit) return;
        if (!ConfigUtils.canAffordUnit(unit.id, this.gameState.gold)) {
            this.logMessage('金币不足，无法购买该单位');
            return;
        }
        this.selectedShopIndex = index;
        this.renderShop();
        this.logMessage('已选择卡牌，请点棋盘目标格进行放置');
    }

    // 在指定格位购买并放置（支持占位替换）
    buyUnitAtPosition(shopIndex, targetPos) {
        const unit = this.gameState.shop[shopIndex];
        if (!unit || !ConfigUtils.canAffordUnit(unit.id, this.gameState.gold)) {
            return false;
        }
        const unitId = unit.id;
        // 扣费 + 商店移除 + 重绘
        this.gameState.gold -= unit.cost;
        this.gameState.shop.splice(shopIndex, 1);
        this.selectedShopIndex = null;
        this.renderShop();
        this.updateUI();
        // 计算应以上场星级
        const count1 = this.getFieldUnitsByIdAndStar(unitId, 1).length;
        const count2 = this.getFieldUnitsByIdAndStar(unitId, 2).length;
        let starToPlace = 1;
        if (count2 >= 2 && count1 >= 2) starToPlace = 3; else if (count1 >= 2) starToPlace = 2;
        // 若目标格有单位：将原单位移到第一个空格；若无空格则进背包
        const occupant = this.gameState.playerUnits.get(targetPos);
        if (occupant) {
            let moved = false;
            for (let i = 0; i < 16; i++) {
                if (i === targetPos) continue;
                if (!this.gameState.playerUnits.has(i)) {
                    this.gameState.playerUnits.set(i, { ...occupant, position: i });
                    moved = true;
                    break;
                }
            }
            if (!moved) {
                const inv = this.gameState.inventory.get(occupant.id) || 0;
                this.gameState.inventory.set(occupant.id, inv + 1);
            }
            this.gameState.playerUnits.delete(targetPos);
        }
        // 在目标格直接创建单位对象
        const stats = ConfigUtils.calculateUnitStats(unitId, starToPlace);
        const newUnit = {
            id: unitId,
            position: targetPos,
            star: starToPlace,
            name: stats.name ?? ConfigUtils.getUnitName(unitId),
            icon: stats.icon ?? '',
            attack: stats.attack,
            health: stats.health,
            maxHealth: stats.maxHealth ?? stats.health,
            type: stats.type,
            healPower: stats.healPower || 0
        };
        this.gameState.playerUnits.set(targetPos, newUnit);
        // 若是高星落位，删除场上其余同名单位
        if (starToPlace > 1) {
            const toRemove = [];
            for (const [pos, u] of this.gameState.playerUnits) {
                if (u.id === unitId && pos !== targetPos) toRemove.push(pos);
            }
            toRemove.forEach(p => this.gameState.playerUnits.delete(p));
        }
        // 渲染
        this.renderPlayerField();
        this.updateUI();
        return true;
    }

    // 点击玩家棋盘格：选中/换位，或处理卡牌点位落子
    handleCellClick(e) {
        if (this.gameState.inBattle) return;
        const cell = e.currentTarget;
        const pos = parseInt(cell.dataset.position);
        const selected = this.selectedCellIndex;
        const unitAtPos = this.gameState.playerUnits.get(pos);
        // 若处于“卡牌点位落子”模式，则优先处理购买落子
        if (this.selectedShopIndex != null) {
            const ok = this.buyUnitAtPosition(this.selectedShopIndex, pos);
            if (!ok) {
                this.logMessage('购买失败，请检查金币或商店状态');
            }
            return;
        }
        // 没有已选择格：如果该格有单位 → 选中它
        if (selected == null) {
            if (unitAtPos) {
                this.selectedCellIndex = pos;
                cell.classList.add('selected');
            }
            return;
        }
        // 再次点击同一格：取消选中
        if (selected === pos) {
            this.clearSelectedCellHighlight();
            this.selectedCellIndex = null;
            return;
        }
        // 与另一格换位
        const from = selected;
        const movingUnit = this.gameState.playerUnits.get(from);
        const toUnit = this.gameState.playerUnits.get(pos);
        this.clearSelectedCellHighlight();
        this.selectedCellIndex = null;
        if (!movingUnit) return;
        this.gameState.playerUnits.set(pos, { ...movingUnit, position: pos });
        if (toUnit) {
            this.gameState.playerUnits.set(from, { ...toUnit, position: from });
        } else {
            this.gameState.playerUnits.delete(from);
        }
        this.renderPlayerField();
        this.checkAutoMergeChain(movingUnit.id);
    }

    // 清除棋盘中高亮的选中格
    clearSelectedCellHighlight() {
        const selectedEl = document.querySelector('#player-grid .grid-cell.selected');
        if (selectedEl) selectedEl.classList.remove('selected');
    }

    generateEnemyUnits() {
        this.gameState.enemyUnits.clear();
        const difficulty = ConfigUtils.getRoundDifficulty(this.gameState.round);
        
        // 随机选取不重复的站位
        const positions = Array.from({ length: 16 }, (_, i) => i);
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        const chosenPositions = positions.slice(0, difficulty.enemyCount);
        
        for (let idx = 0; idx < chosenPositions.length; idx++) {
            const pos = chosenPositions[idx];
            const starLevel = this.getRandomStarLevel(difficulty.enemyStarDistribution);
            const unitId = ConfigUtils.getRandomUnitId();
            const stats = ConfigUtils.calculateUnitStats(unitId, starLevel);
            const unit = {
                id: unitId,
                position: pos,
                star: starLevel,
                name: stats.name ?? ConfigUtils.getUnitName(unitId),
                icon: stats.icon ?? '',
                attack: stats.attack,
                health: stats.health,
                maxHealth: stats.maxHealth ?? stats.health,
                type: stats.type,
                healPower: stats.healPower || 0
            };
            
            const enemyBuffs = GameConfig.gameSettings.enemyBuffs;
            const roundScaling = Math.min(
                1 + (this.gameState.round - 1) * enemyBuffs.roundScaling, 
                enemyBuffs.maxScaling
            );
            
            unit.attack = Math.floor(unit.attack * difficulty.enemyLevel * enemyBuffs.attackMultiplier * roundScaling);
            unit.health = Math.floor(unit.health * difficulty.enemyLevel * enemyBuffs.healthMultiplier * roundScaling);
            unit.maxHealth = unit.health;
            
            this.gameState.enemyUnits.set(pos, unit);
        }
        
        this.renderEnemyField();
    }
    
    getRandomStarLevel(distribution) {
        const rand = Math.random();
        let cumulative = 0;
        for (const [star, probability] of Object.entries(distribution)) {
            cumulative += probability;
            if (rand <= cumulative) return parseInt(star);
        }
        return 1;
    }
    
    // ========== 战斗回合 ==========
    async startBattle() {
        if (this.gameState.inBattle) return;
        this.gameState.inBattle = true;
        this.logMessage(`第${this.gameState.round}回合战斗开始！`);
        
        // 重置我方血量（复活）
        this.gameState.playerUnits.forEach(u => { u.health = u.maxHealth; });
        // 复活后立刻渲染，确保视觉上单位从上一局的死亡状态中“重生”
        this.renderPlayerField();
        
        let battleRound = 1;
        while (this.hasAliveUnits(this.gameState.playerUnits) && 
               this.hasAliveUnits(this.gameState.enemyUnits) && 
               battleRound <= 50) {
            this.logMessage(`战斗轮次 ${battleRound}`);
            await this.executeBattleRound();
            battleRound++;
            await this.sleep(GameConfig.battleSettings.attackDelay);
        }
        
        const playerAlive = this.hasAliveUnits(this.gameState.playerUnits);
        const enemyAlive = this.hasAliveUnits(this.gameState.enemyUnits);
        const isWin = playerAlive && !enemyAlive;
        const isDefeat = !playerAlive && enemyAlive;
        
        const round = this.gameState.round;
        const difficulty = GameConfig.gameSettings.roundDifficulty[round] || GameConfig.gameSettings.roundDifficulty[10];
        const goldReward = isWin ? difficulty.goldReward.win : difficulty.goldReward.lose;
        
        const goldSettings = GameConfig.gameSettings.goldPerRound;
        const interest = Math.min(Math.floor(this.gameState.gold * goldSettings.interestRate), goldSettings.maxInterest);
        
        let winStreakBonus = 0;
        if (isWin) {
            this.gameState.winStreak = (this.gameState.winStreak || 0) + 1;
            winStreakBonus = Math.min(this.gameState.winStreak, 3) * goldSettings.winBonus;
            this.logMessage('胜利！');
        } else if (isDefeat) {
            this.logMessage('失败！');
            this.gameState.health -= GameConfig.gameSettings.defeatHealthLoss;
            this.gameState.winStreak = 0;
        } else {
            this.logMessage('平局！');
            this.gameState.winStreak = 0;
        }
        
        const totalGold = goldReward + interest + winStreakBonus;
        this.gameState.gold += totalGold;
        this.logMessage(`${isWin ? '胜利' : (isDefeat ? '失败' : '平局')}！获得 ${goldReward} 金币 + ${interest} 利息 + ${winStreakBonus} 连胜奖励 = ${totalGold} 金币`);
        
        this.gameState.round++;
        this.restorePlayerUnitsHealth();
        
        // 不使用弹窗：根据胜/负切换控件与流程
        if (this.gameState.health <= 0 || isDefeat) {
            if (this.gameState.health <= 0) {
                this.logMessage('游戏结束！');
            }
            // 失败或游戏结束：隐藏刷新/开战，仅显示“重新开始”
            this.showDefeatControls();
            this.gameState.inBattle = false;
            this.updateUI();
            return;
        }
        
        // 胜利或平局：正常进入下一回合
        this.generateEnemyUnits();
        this.refreshShop(true);
        this.showNormalControls();
        
        this.gameState.inBattle = false;
        this.updateUI();
    }
    
    async executeBattleRound() {
        const allUnits = [];
        this.gameState.playerUnits.forEach(unit => { if (unit.health > 0) allUnits.push({ unit, isPlayer: true }); });
        this.gameState.enemyUnits.forEach(unit => { if (unit.health > 0) allUnits.push({ unit, isPlayer: false }); });
        
        for (let i = allUnits.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allUnits[i], allUnits[j]] = [allUnits[j], allUnits[i]];
        }
        
        for (const { unit, isPlayer } of allUnits) {
            if (unit.health <= 0) continue;
            const enemies = isPlayer ? this.gameState.enemyUnits : this.gameState.playerUnits;
            const target = this.findTarget(unit, enemies, isPlayer);
            if (target) {
                const attack = { attacker: unit, target, isPlayer };
                await this.executeAttack(attack);
                this.renderPlayerField();
                this.renderEnemyField();
                if (!this.hasAliveUnits(this.gameState.playerUnits) || !this.hasAliveUnits(this.gameState.enemyUnits)) break;
            }
        }
    }
    
    findTarget(attacker, enemies, isPlayerAttacking) {
        // 上下对阵（竖屏堆叠）：按行扫描，优先“双方接壤行”
        if (this.isVerticalStackedLayout()) {
            const frontRows = isPlayerAttacking ? [3, 2, 1, 0] : [0, 1, 2, 3];
            for (const r of frontRows) {
                for (let c = 0; c < 4; c++) {
                    const pos = r * 4 + c;
                    const t = enemies.get(pos);
                    if (t && t.health > 0) return t;
                }
            }
            return null;
        }

        // 左右对阵（横屏）：按列扫描，优先“双方接壤列”
        const frontColumns = isPlayerAttacking ? [0, 1, 2, 3] : [3, 2, 1, 0];
        for (const c of frontColumns) {
            for (let r = 0; r < 4; r++) {
                const pos = r * 4 + c;
                const t = enemies.get(pos);
                if (t && t.health > 0) return t;
            }
        }
        return null;
    }
    
    // 修复点：对“目标在哪个战场”的布尔传递统一为 targetIsOnEnemyGrid = attack.isPlayer
    async executeAttack(attack) {
        const damage = attack.attacker.attack;
        this.logMessage(`${attack.attacker.name} 对 ${attack.target.name} 造成 ${damage} 点伤害`);
        
        // 播动画
        this.playAttackAnimation(attack.attacker.position, attack.isPlayer);
        this.playHitAnimation(attack.target.position, /*targetIsEnemyGrid*/ attack.isPlayer);
        
        // 0.3s后结算
        await this.sleep(300);
        
        attack.target.health = Math.max(0, attack.target.health - damage);
        
        // 正确战场显示飘字 + 刷新血量
        this.showDamageText(attack.target.position, damage, /*targetIsEnemyGrid*/ attack.isPlayer);
        this.updateHealthDisplay(attack.target.position, attack.target, /*targetIsEnemyGrid*/ attack.isPlayer);
        
        // 攻击结算后：触发己方治疗（由己方场上所有 support 单位提供）
        this.triggerTeamHeal(attack.isPlayer);
        
        await this.sleep(300);
    }

    // 触发己方群体治疗：统计己方所有辅助单位 healPower 之和，按该值为所有己方存活单位回血
    triggerTeamHeal(isPlayerSide) {
        const allies = isPlayerSide ? this.gameState.playerUnits : this.gameState.enemyUnits;
        let totalHeal = 0;
        allies.forEach(u => { if (u.type === 'support' && u.healPower > 0 && u.health > 0) totalHeal += u.healPower; });
        if (totalHeal <= 0) return;
        allies.forEach((u, pos) => {
            if (u.health <= 0) return;
            const old = u.health;
            u.health = Math.min(u.maxHealth, u.health + totalHeal);
            const gained = u.health - old;
            if (gained > 0) {
                // 飘绿色“+血”
                this.showHealText(pos, gained, /*targetIsEnemyGrid*/ !isPlayerSide);
                this.updateHealthDisplay(pos, u, /*targetIsEnemyGrid*/ !isPlayerSide);
            }
        });
    }

    // 绿色的治疗飘字
    showHealText(position, heal, targetIsEnemyGrid) {
        const gridId = targetIsEnemyGrid ? 'enemy-grid' : 'player-grid';
        const grid = document.getElementById(gridId);
        const cell = grid.children[position];
        if (!cell) return;
        const healthElement = cell.querySelector('.health-text');
        const healText = document.createElement('div');
        healText.className = 'heal-text';
        healText.textContent = `+${heal}`;
        healText.style.position = 'absolute';
        healText.style.left = '50%';
        healText.style.transform = 'translateX(-50%)';
        healText.style.pointerEvents = 'none';
        if (healthElement) {
            const topPx = Math.max(0, healthElement.offsetTop - 12);
            healText.style.top = `${topPx}px`;
        } else {
            healText.style.top = '10px';
        }
        cell.appendChild(healText);
        setTimeout(() => {
            if (healText.parentNode) healText.parentNode.removeChild(healText);
        }, GameConfig.battleSettings.damageDisplayTime);
    }

    // 红色的伤害飘字
    showDamageText(position, damage, targetIsEnemyGrid) {
        const gridId = targetIsEnemyGrid ? 'enemy-grid' : 'player-grid';
        const grid = document.getElementById(gridId);
        const cell = grid.children[position];
        if (!cell) return;
        const healthElement = cell.querySelector('.health-text');
        const dmgText = document.createElement('div');
        dmgText.className = 'damage-text';
        dmgText.textContent = `-${damage}`;
        dmgText.style.color = '#ff4d4f';
        dmgText.style.fontWeight = 'bold';
        dmgText.style.position = 'absolute';
        dmgText.style.left = '50%';
        dmgText.style.transform = 'translateX(-50%)';
        dmgText.style.pointerEvents = 'none';
        if (healthElement) {
            const topPx = Math.max(0, healthElement.offsetTop - 12);
            dmgText.style.top = `${topPx}px`;
        } else {
            dmgText.style.top = '10px';
        }
        cell.appendChild(dmgText);
        setTimeout(() => {
            if (dmgText.parentNode) dmgText.parentNode.removeChild(dmgText);
        }, GameConfig.battleSettings.damageDisplayTime);
    }

    // 更新某格的生命显示
    updateHealthDisplay(position, unit, targetIsEnemyGrid) {
        const gridId = targetIsEnemyGrid ? 'enemy-grid' : 'player-grid';
        const grid = document.getElementById(gridId);
        const cell = grid.children[position];
        if (!cell) return;
        const healthEl = cell.querySelector('.health-text');
        if (healthEl) healthEl.textContent = `${unit.health}`;
    }

    // 攻击动画（轻微缩放）
    playAttackAnimation(position, isPlayerSide) {
        const gridId = isPlayerSide ? 'player-grid' : 'enemy-grid';
        const grid = document.getElementById(gridId);
        const cell = grid.children[position];
        if (!cell) return;
        const unitEl = cell.querySelector('.unit');
        if (!unitEl) return;
        unitEl.style.transition = 'transform 0.2s';
        unitEl.style.transform = 'scale(1.1)';
        setTimeout(() => {
            unitEl.style.transform = 'scale(1)';
        }, 200);
    }

    // 受击动画（短暂闪烁）
    playHitAnimation(position, targetIsEnemyGrid) {
        const gridId = targetIsEnemyGrid ? 'enemy-grid' : 'player-grid';
        const grid = document.getElementById(gridId);
        const cell = grid.children[position];
        if (!cell) return;
        const unitEl = cell.querySelector('.unit');
        if (!unitEl) return;
        const originalBg = unitEl.style.backgroundColor;
        unitEl.style.transition = 'background-color 0.2s';
        unitEl.style.backgroundColor = 'rgba(255,0,0,0.25)';
        setTimeout(() => {
            unitEl.style.backgroundColor = originalBg || '';
        }, 200);
    }
    restorePlayerUnitsHealth() {
        this.gameState.playerUnits.forEach(u => { u.health = u.maxHealth; });
        this.renderPlayerField();
        this.logMessage('己方单位生命值已恢复');
    }
    
    hasAliveUnits(units) {
        for (const [, u] of units) if (u.health > 0) return true;
        return false;
    }
    
    bindEvents() {
        document.getElementById('refresh-shop').addEventListener('click', () => this.refreshShop());
        document.getElementById('start-battle').addEventListener('click', () => this.startBattle());
        document.querySelector('#unit-modal .close').addEventListener('click', () => {
            document.getElementById('unit-modal').style.display = 'none';
        });
        
        // 重新开始（工具栏按钮）
        const restartBtn = document.getElementById('restart-game-btn');
        if (restartBtn) restartBtn.addEventListener('click', () => this.restartGame());
        
        // 结果弹窗相关绑定移除（不再使用弹窗展示结果）
    }

    restartGame() {
        if (this.gameState.inBattle) {
            this.logMessage('战斗进行中，无法重开。请等待战斗结束。');
            return;
        }
        // 清理所有状态并恢复初始值
        this.gameState = {
            round: 1,
            gold: GameConfig.gameSettings.initialGold,
            health: GameConfig.gameSettings.initialHealth,
            playerUnits: new Map(),
            enemyUnits: new Map(),
            shop: [],
            inventory: new Map(),
            inBattle: false,
            winStreak: 0
        };
        
        // 重新渲染格子、敌人与商店
        this.renderPlayerField();
        this.renderEnemyField();
        this.refreshShop(true);
        this.generateEnemyUnits();
        
        // 清空日志
        const log = document.getElementById('log-content');
        if (log) log.innerHTML = '';
        
        // 重开后恢复正常控件
        this.showNormalControls();
        
        this.updateUI();
        this.logMessage('游戏已重新开始');
    }
    
    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

// 游戏初始化
document.addEventListener('DOMContentLoaded', () => {
    window.game = new AutoChessGame();
});
