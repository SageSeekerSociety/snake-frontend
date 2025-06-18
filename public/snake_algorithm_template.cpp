#include <iostream>
#include <vector>
#include <string>
#include <random>
#include <algorithm>
#include <chrono>
#include <memory>
#include <optional>
#include <unordered_map>

// 定义自己的学号常量，请替换为你的实际学号
constexpr int MY_STUDENT_ID = 2023000000;

// 使用C++17特性

/**
 * 游戏中的坐标点
 */
struct Position {
    int x{0};
    int y{0};
    
    // 重载比较运算符，用于在集合中存储和查找位置
    bool operator==(const Position& other) const {
        return x == other.x && y == other.y;
    }
    
    // 计算曼哈顿距离
    int manhattanDistance(const Position& other) const {
        return std::abs(x - other.x) + std::abs(y - other.y);
    }
};

// 为Position提供哈希函数，以便在unordered_map/set中使用
namespace std {
    template<>
    struct hash<Position> {
        size_t operator()(const Position& pos) const {
            return hash<int>()(pos.x) ^ (hash<int>()(pos.y) << 1);
        }
    };
}

/**
 * 游戏中的物品（食物、陷阱、墙）
 */
struct GameObject {
    Position position;
    int value{0};  // 正数为食物分值，-1为增长豆，-2为陷阱，-4为墙
    
    // 判断物品类型的辅助函数
    bool isNormalFood() const { return value > 0; }
    bool isGrowthBean() const { return value == -1; }
    bool isTrap() const { return value == -2; }
    bool isWall() const { return value == -4; }
};

/**
 * 蛇的定义
 */
class Snake {
public:
    int id{0};                     // 蛇的ID（学号）
    int length{0};                 // 蛇的长度
    int score{0};                  // 蛇的得分
    int direction{0};              // 当前方向（0-左，1-上，2-右，3-下）
    int shieldCooldown{0};         // 护盾冷却时间
    int shieldDuration{0};         // 护盾剩余有效时间
    std::vector<Position> body;    // 蛇的身体，从头到尾
    
    // 获取蛇头位置的便捷方法
    Position getHead() const {
        return body.empty() ? Position{} : body.front();
    }
    
    // 判断蛇是否有护盾
    bool hasShield() const {
        return shieldDuration > 0;
    }
    
    // 判断蛇是否可以使用护盾
    bool canUseShield() const {
        return shieldCooldown == 0 && score >= 20;
    }
};

/**
 * 游戏状态
 */
class GameState {
public:
    int remainingTicks{0};                  // 剩余游戏时间
    std::vector<GameObject> objects;        // 游戏中的物品（食物、陷阱、墙）
    std::vector<Snake> snakes;              // 所有蛇
    std::optional<Snake> mySnake;           // 我的蛇（可能不存在）
    
    // 解析输入并构建游戏状态
    void parseInput() {
        // 读取剩余时间
        std::cin >> remainingTicks;
        
        // 读取物品数量和详情
        int objectCount;
        std::cin >> objectCount;
        objects.resize(objectCount);
        
        for (int i = 0; i < objectCount; ++i) {
            std::cin >> objects[i].position.x >> objects[i].position.y >> objects[i].value;
        }
        
        // 读取蛇的数量和详情
        int snakeCount;
        std::cin >> snakeCount;
        snakes.resize(snakeCount);
        
        for (int i = 0; i < snakeCount; ++i) {
            auto& snake = snakes[i];
            std::cin >> snake.id >> snake.length >> snake.score 
                     >> snake.direction >> snake.shieldCooldown >> snake.shieldDuration;
            
            snake.body.resize(snake.length);
            for (int j = 0; j < snake.length; ++j) {
                std::cin >> snake.body[j].x >> snake.body[j].y;
            }
            
            // 检查是否是我的蛇（使用MY_STUDENT_ID常量）
            if (snake.id == MY_STUDENT_ID) {
                mySnake = snake;
            }
        }
    }
    
    // 获取地图上某个位置的物品，如果没有则返回nullptr
    const GameObject* getObjectAt(const Position& pos) const {
        auto it = std::find_if(objects.begin(), objects.end(), 
            [&pos](const GameObject& obj) { return obj.position.x == pos.x && obj.position.y == pos.y; });
        return it != objects.end() ? &(*it) : nullptr;
    }
    
    // 检查位置是否有蛇的身体
    bool hasSnakeBodyAt(const Position& pos) const {
        for (const auto& snake : snakes) {
            // 跳过蛇头，只检查身体
            for (size_t i = 1; i < snake.body.size(); ++i) {
                if (snake.body[i].x == pos.x && snake.body[i].y == pos.y) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // 检查位置是否有蛇头
    bool hasSnakeHeadAt(const Position& pos) const {
        for (const auto& snake : snakes) {
            if (!snake.body.empty() && snake.body[0].x == pos.x && snake.body[0].y == pos.y) {
                return true;
            }
        }
        return false;
    }
    
    // 检查位置是否安全（没有墙、障碍物、蛇身体）
    bool isSafePosition(const Position& pos) const {
        // 检查是否超出地图边界
        if (pos.x < 0 || pos.x >= 40 || pos.y < 0 || pos.y >= 30) {
            return false;
        }
        
        // 检查是否有墙
        const auto* obj = getObjectAt(pos);
        if (obj && obj->isWall()) {
            return false;
        }
        
        // 检查是否有蛇的身体
        if (hasSnakeBodyAt(pos)) {
            return false;
        }
        
        return true;
    }
};

/**
 * 决策引擎
 */
class DecisionEngine {
public:
    // 方向常量
    static constexpr int LEFT = 0;
    static constexpr int UP = 1;
    static constexpr int RIGHT = 2;
    static constexpr int DOWN = 3;
    static constexpr int SHIELD = 4;
    
    // 方向对应的位置偏移
    static const std::vector<Position> DIRECTION_OFFSETS;
    
    // 随机数生成器
    std::mt19937 rng;
    
    DecisionEngine() : rng(std::chrono::steady_clock::now().time_since_epoch().count()) {}
    
    // 做出决策
    int makeDecision(const GameState& state) {
        // 如果没有我的蛇，返回默认方向
        if (!state.mySnake) {
            return randomDirection();
        }
        
        const auto& mySnake = *state.mySnake;
        
        // 随机决定是否使用护盾（10%概率）
        if (mySnake.canUseShield() && (rng() % 10 == 0)) {
            return SHIELD;
        }
        
        // 获取当前位置
        Position currentPos = mySnake.getHead();
        
        // 计算每个方向的安全性
        std::vector<int> safeDirections;
        for (int dir = 0; dir < 4; ++dir) {
            Position nextPos = {
                currentPos.x + DIRECTION_OFFSETS[dir].x,
                currentPos.y + DIRECTION_OFFSETS[dir].y
            };
            
            if (state.isSafePosition(nextPos)) {
                safeDirections.push_back(dir);
            }
        }
        
        // 如果有安全方向，随机选择一个
        if (!safeDirections.empty()) {
            return safeDirections[rng() % safeDirections.size()];
        }
        
        // 如果没有安全方向但可以使用护盾，则使用护盾
        if (mySnake.canUseShield()) {
            return SHIELD;
        }
        
        // 如果没有安全方向且不能使用护盾，随机选择一个方向
        return randomDirection();
    }
    
private:
    // 生成随机方向
    int randomDirection() {
        return rng() % 4;  // 0-3之间的随机数
    }
};

// 初始化方向偏移
const std::vector<Position> DecisionEngine::DIRECTION_OFFSETS = {
    {0, -1},  // LEFT
    {-1, 0},  // UP
    {0, 1},   // RIGHT
    {1, 0}    // DOWN
};

/**
 * 主函数
 */
int main() {
    // 关闭同步以提高IO性能
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    
    try {
        // 解析游戏状态
        GameState gameState;
        gameState.parseInput();
        
        // 创建决策引擎并做出决策
        DecisionEngine engine;
        int decision = engine.makeDecision(gameState);
        
        // 输出决策
        std::cout << decision << std::endl;
        
        // 确保输出被刷新
        std::cout.flush();
    } catch (const std::exception& e) {
        // 发生异常时，输出默认决策（向右）
        std::cerr << "Error: " << e.what() << std::endl;
        std::cout << 2 << std::endl;  // 默认向右
        std::cout.flush();
    }
    
    return 0;
}
