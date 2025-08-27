#include <iostream>
#include <vector>
#include <string>
#include <random>
#include <chrono>

using namespace std;

// 常量
constexpr int MAXN = 40;
constexpr int MAXM = 30;
constexpr int MAX_TICKS = 256;
constexpr int MYID = 2000000000; // 此处替换为你的学号！

struct Point {
    int y, x;
};

struct Item {
    Point pos;
    int value;
    int lifetime;
};

struct Snake {
    int id;
    int length;
    int score;
    int direction;
    int shield_cd;
    int shield_time;
    bool has_key;
    vector<Point> body;

    const Point& get_head() const {
        return body.front();
    }
};

struct Chest {
    Point pos;
    int score;
};

struct Key {
    Point pos;
    int holder_id;
    int remaining_time;
};

struct SafeZoneBounds {
    int x_min, y_min, x_max, y_max;
};

struct GameState {
    int remaining_ticks;
    vector<Item> items;
    vector<Snake> snakes;
    vector<Chest> chests;
    vector<Key> keys;
    SafeZoneBounds current_safe_zone;
    int next_shrink_tick;
    SafeZoneBounds next_safe_zone;
    int final_shrink_tick;
    SafeZoneBounds final_safe_zone;

    int self_idx;

    const Snake& get_self() const {
        return snakes[self_idx];
    }
};

void read_game_state(GameState& state) {
    cin >> state.remaining_ticks;

    int item_count;
    cin >> item_count;
    state.items.resize(item_count);
    for (int i = 0; i < item_count; ++i) {
        cin >> state.items[i].pos.y >> state.items[i].pos.x >> state.items[i].value >> state.items[i].lifetime;
    }

    int snake_count;
    cin >> snake_count;
    state.snakes.resize(snake_count);
    for (int i = 0; i < snake_count; ++i) {
        cin >> state.snakes[i].id >> state.snakes[i].length >> state.snakes[i].score
            >> state.snakes[i].direction >> state.snakes[i].shield_cd
            >> state.snakes[i].shield_time >> state.snakes[i].has_key;
        
        state.snakes[i].body.resize(state.snakes[i].length);
        for (int j = 0; j < state.snakes[i].length; ++j) {
            cin >> state.snakes[i].body[j].y >> state.snakes[i].body[j].x;
        }

        if (state.snakes[i].id == MYID) {
            state.self_idx = i;
        }
    }

    int chest_count;
    cin >> chest_count;
    state.chests.resize(chest_count);
    for (int i = 0; i < chest_count; ++i) {
        cin >> state.chests[i].pos.y >> state.chests[i].pos.x >> state.chests[i].score;
    }

    int key_count;
    cin >> key_count;
    state.keys.resize(key_count);
    for (int i = 0; i < key_count; ++i) {
        cin >> state.keys[i].pos.y >> state.keys[i].pos.x >> state.keys[i].holder_id >> state.keys[i].remaining_time;
    }

    cin >> state.current_safe_zone.x_min >> state.current_safe_zone.y_min >> state.current_safe_zone.x_max >> state.current_safe_zone.y_max;
    cin >> state.next_shrink_tick >> state.next_safe_zone.x_min >> state.next_safe_zone.y_min >> state.next_safe_zone.x_max >> state.next_safe_zone.y_max;
    cin >> state.final_shrink_tick >> state.final_safe_zone.x_min >> state.final_safe_zone.y_min >> state.final_safe_zone.x_max >> state.final_safe_zone.y_max;

    // 如果上一个 tick 往 Memory 里写入了内容，在这里读取，注意处理第一个 tick 的情况
    // if (state.remaining_ticks < MAX_TICKS) {
    //     // 处理 Memory 读取
    // }
}

int main() {
    // 读取当前 tick 的所有游戏状态
    GameState current_state;
    read_game_state(current_state);

    // 随机选择一个方向作为决策
    mt19937 rng(chrono::steady_clock::now().time_since_epoch().count());
    uniform_int_distribution<int> dist(0, 3);
    int decision = dist(rng);
    cout << decision << endl;
    // C++ 23 也可使用 std::print
    // 如果需要写入 Memory，在此处写入

    return 0;
}
