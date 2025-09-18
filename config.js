// 游戏配置文件 - 模拟Excel数据表格
const GameConfig = {
    // 单位数据表 - 类似Excel表格结构
    units: {
        // 单位ID: { 名称, 图标, 基础攻击力, 基础生命值, 成本, 类型 }
        'warrior': {
            name: '战士',
            icon: '⚔️',
            baseAttack: 15,
            baseHealth: 100,
            cost: 1,
            type: 'melee',
            description: '近战单位，攻击力中等，生命值较高'
        },
        'archer': {
            name: '弓箭手',
            icon: '🏹',
            baseAttack: 20,
            baseHealth: 60,
            cost: 2,
            type: 'ranged',
            description: '远程单位，攻击力高，生命值较低'
        },
        'mage': {
            name: '法师',
            icon: '🔮',
            baseAttack: 25,
            baseHealth: 50,
            cost: 3,
            type: 'magic',
            description: '魔法单位，攻击力很高，生命值很低'
        },
        'knight': {
            name: '骑士',
            icon: '🛡️',
            baseAttack: 12,
            baseHealth: 120,
            cost: 2,
            type: 'tank',
            description: '坦克单位，攻击力较低，生命值很高'
        },
        'assassin': {
            name: '刺客',
            icon: '🗡️',
            baseAttack: 30,
            baseHealth: 40,
            cost: 3,
            type: 'assassin',
            description: '刺客单位，攻击力极高，生命值极低'
        },
        'priest': {
            name: '牧师',
            icon: '✨',
            baseAttack: 8,
            baseHealth: 80,
            cost: 2,
            type: 'support',
            description: '辅助单位，攻击力低，生命值中等'
        }
    },
    
    // 星级加成表 - 类似Excel表格
    starMultipliers: {
        1: { attack: 1.0, health: 1.0 },    // 1星：无加成
        2: { attack: 1.8, health: 1.8 },    // 2星：1.8倍
        3: { attack: 3.2, health: 3.2 }     // 3星：3.2倍
    },
    
    // 游戏参数表
    gameSettings: {
        initialGold: 10,
        initialHealth: 100,
        // 新增：失败扣血可配置
        defeatHealthLoss: 100,
        shopRefreshCost: 2,
        shopSize: 5,
        maxUnitsOnField: 16,
        battlefieldSize: { width: 4, height: 4 },
        
        // 每回合金币获得配置
        goldPerRound: {
            base: 5,                    // 基础金币
            winBonus: 1,               // 连胜奖励
            interestRate: 0.1,         // 利息率（每10金币获得1金币利息）
            maxInterest: 5             // 最大利息
        },
        
        // 回合难度递增表 - 更详细的配置
        roundDifficulty: {
            1: { 
                enemyCount: 2, 
                enemyLevel: 1.0,
                enemyStarDistribution: { 1: 1.0, 2: 0.0, 3: 0.0 },
                goldReward: { win: 3, lose: 1 }
            },
            2: { 
                enemyCount: 3, 
                enemyLevel: 1.0,
                enemyStarDistribution: { 1: 0.9, 2: 0.1, 3: 0.0 },
                goldReward: { win: 3, lose: 1 }
            },
            3: { 
                enemyCount: 3, 
                enemyLevel: 1.2,
                enemyStarDistribution: { 1: 0.8, 2: 0.2, 3: 0.0 },
                goldReward: { win: 4, lose: 1 }
            },
            4: { 
                enemyCount: 4, 
                enemyLevel: 1.2,
                enemyStarDistribution: { 1: 0.7, 2: 0.3, 3: 0.0 },
                goldReward: { win: 4, lose: 2 }
            },
            5: { 
                enemyCount: 4, 
                enemyLevel: 1.5,
                enemyStarDistribution: { 1: 0.6, 2: 0.3, 3: 0.1 },
                goldReward: { win: 5, lose: 2 }
            },
            6: { 
                enemyCount: 5, 
                enemyLevel: 1.5,
                enemyStarDistribution: { 1: 0.5, 2: 0.4, 3: 0.1 },
                goldReward: { win: 5, lose: 2 }
            },
            7: { 
                enemyCount: 5, 
                enemyLevel: 1.8,
                enemyStarDistribution: { 1: 0.4, 2: 0.4, 3: 0.2 },
                goldReward: { win: 6, lose: 2 }
            },
            8: { 
                enemyCount: 6, 
                enemyLevel: 1.8,
                enemyStarDistribution: { 1: 0.3, 2: 0.5, 3: 0.2 },
                goldReward: { win: 6, lose: 3 }
            },
            9: { 
                enemyCount: 6, 
                enemyLevel: 2.0,
                enemyStarDistribution: { 1: 0.2, 2: 0.5, 3: 0.3 },
                goldReward: { win: 7, lose: 3 }
            },
            10: { 
                enemyCount: 7, 
                enemyLevel: 2.2,
                enemyStarDistribution: { 1: 0.1, 2: 0.4, 3: 0.5 },
                goldReward: { win: 8, lose: 3 }
            }
        },
        
        // 敌方单位属性加成配置
        enemyBuffs: {
            healthMultiplier: 1.0,      // 生命值倍数
            attackMultiplier: 1.0,      // 攻击力倍数
            roundScaling: 0.1,          // 每回合递增比例
            maxScaling: 3.0             // 最大缩放倍数
        },
        
        // 金币奖励表（已废弃，使用roundDifficulty中的goldReward）
        goldRewards: {
            win: 3,
            lose: 1,
            roundBonus: 1
        }
    },
    
    // 战斗参数
    battleSettings: {
        attackDelay: 1000,      // 攻击间隔（毫秒）
        animationDuration: 500, // 动画持续时间
        damageDisplayTime: 1000 // 伤害数字显示时间
    }
};

// 工具函数 - 类似Excel函数
const ConfigUtils = {
    // 根据星级计算单位属性
    calculateUnitStats: function(unitId, star) {
        const baseUnit = GameConfig.units[unitId];
        const multiplier = GameConfig.starMultipliers[star];
        
        return {
            ...baseUnit,
            attack: Math.floor(baseUnit.baseAttack * multiplier.attack),
            health: Math.floor(baseUnit.baseHealth * multiplier.health),
            maxHealth: Math.floor(baseUnit.baseHealth * multiplier.health),
            star: star
        };
    },
    
    // 获取回合难度
    getRoundDifficulty: function(round) {
        const maxRound = Math.max(...Object.keys(GameConfig.gameSettings.roundDifficulty).map(Number));
        const targetRound = Math.min(round, maxRound);
        return GameConfig.gameSettings.roundDifficulty[targetRound];
    },
    
    // 获取随机单位ID
    getRandomUnitId: function() {
        const unitIds = Object.keys(GameConfig.units);
        return unitIds[Math.floor(Math.random() * unitIds.length)];
    },
    
    // 获取单位成本
    getUnitCost: function(unitId) {
        return GameConfig.units[unitId].cost;
    },
    
    // 检查是否可以购买单位
    canAffordUnit: function(unitId, currentGold) {
        return currentGold >= this.getUnitCost(unitId);
    }
};

// 导出配置（如果在Node.js环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameConfig, ConfigUtils };
}