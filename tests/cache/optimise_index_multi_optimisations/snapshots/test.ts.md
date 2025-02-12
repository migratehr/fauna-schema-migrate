# Snapshot report for `tests/cache/optimise_index_multi_optimisations/test.ts`

The actual snapshot is saved in `test.ts.snap`.

Generated by [AVA](https://avajs.dev).

## when step size is 1, it should create the correct folder and query

> Snapshot 1

    [
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/_2022-12-08T19:45:58.674Z_1',
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/2022-12-08T19:45:58.674Z_2022-12-08T19:45:58.685Z_1',
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/2022-12-08T19:45:58.685Z_2022-12-08T19:45:58.691Z_1',
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/2022-12-08T19:45:58.691Z_2022-12-08T19:45:58.699Z_1',
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/2022-12-08T19:45:58.699Z_2022-12-08T19:45:58.706Z_1',
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/2022-12-08T19:45:58.706Z_2022-12-08T19:45:58.708Z_1',
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/2022-12-08T19:45:58.708Z_2022-12-08T19:45:58.710Z_1',
    ]

> Snapshot 2

    [
      'Let([{"var0": Select(["ref"], CreateIndex({"name": "_cache_optimised_test_index_0"}))}], Map(["2022-12-08T19:45:58.674Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
      'Let([{"var0": Select(["ref"], CreateRole({"name": "test_role", "privileges": {"resource": Index("_cache_optimised_test_index_0"), "actions": {"read": true}}}))}], Map(["2022-12-08T19:45:58.685Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
      'Let([{"var0": Select(["ref"], Delete(Index("_cache_optimised_test_index_0")))}, {"var1": Select(["ref"], Update(Role("test_role"), {"privileges": {}, "data": null, "membership": null}))}], Map(["2022-12-08T19:45:58.691Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
      'Let([{"var0": Select(["ref"], CreateIndex({"name": "_cache_optimised_test_index_1"}))}, {"var1": Select(["ref"], Update(Role("test_role"), {"privileges": {"resource": Var("var0"), "actions": {"read": true}}, "data": null, "membership": null}))}], Map(["2022-12-08T19:45:58.699Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
      'Let([{"var0": Select(["ref"], CreateRole({"name": "test_role_2", "privileges": {"resource": Index("_cache_optimised_test_index_1"), "actions": {"read": true}}}))}], Map(["2022-12-08T19:45:58.706Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
      'Let([{"var0": Select(["ref"], Delete(Index("_cache_optimised_test_index_1")))}, {"var1": Select(["ref"], Update(Role("test_role_2"), {"privileges": {}, "data": null, "membership": null}))}, {"var2": Select(["ref"], Update(Role("test_role"), {"privileges": {}, "data": null, "membership": null}))}], Map(["2022-12-08T19:45:58.708Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
      'Let([{"var0": Select(["ref"], CreateIndex({"name": "test_index"}))}, {"var1": Select(["ref"], Update(Role("test_role_2"), {"privileges": {"resource": Var("var0"), "actions": {"read": true}}, "data": null, "membership": null}))}, {"var2": Select(["ref"], Update(Role("test_role"), {"privileges": {"resource": Var("var0"), "actions": {"read": true}}, "data": null, "membership": null}))}], Map(["2022-12-08T19:45:58.710Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
    ]

> Snapshot 3

    [
      '{"target":"2022-12-08T19:45:58.674Z","stepSize":1,"isComplete":true,"migrations":["2022-12-08T19:45:58.674Z"],"isOptimised":true}',
      '{"from":"2022-12-08T19:45:58.674Z","target":"2022-12-08T19:45:58.685Z","stepSize":1,"isComplete":true,"migrations":["2022-12-08T19:45:58.685Z"],"isOptimised":true}',
      '{"from":"2022-12-08T19:45:58.685Z","target":"2022-12-08T19:45:58.691Z","stepSize":1,"isComplete":true,"migrations":["2022-12-08T19:45:58.691Z"],"isOptimised":true}',
      '{"from":"2022-12-08T19:45:58.691Z","target":"2022-12-08T19:45:58.699Z","stepSize":1,"isComplete":true,"migrations":["2022-12-08T19:45:58.699Z"],"isOptimised":true}',
      '{"from":"2022-12-08T19:45:58.699Z","target":"2022-12-08T19:45:58.706Z","stepSize":1,"isComplete":true,"migrations":["2022-12-08T19:45:58.706Z"],"isOptimised":true}',
      '{"from":"2022-12-08T19:45:58.706Z","target":"2022-12-08T19:45:58.708Z","stepSize":1,"isComplete":true,"migrations":["2022-12-08T19:45:58.708Z"],"isOptimised":true}',
      '{"from":"2022-12-08T19:45:58.708Z","target":"2022-12-08T19:45:58.710Z","stepSize":1,"isComplete":true,"migrations":["2022-12-08T19:45:58.710Z"]}',
    ]

## when step size is more than 1, it should create the correct folder and query

> Snapshot 1

    [
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/_2022-12-08T19:45:58.685Z_2',
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/2022-12-08T19:45:58.685Z_2022-12-08T19:45:58.699Z_2',
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/2022-12-08T19:45:58.699Z_2022-12-08T19:45:58.708Z_2',
      'tests/cache/optimise_index_multi_optimisations/migrations/.cache/2022-12-08T19:45:58.708Z_2022-12-08T19:45:58.710Z_2',
    ]

> Snapshot 2

    [
      'Let([{"var0": Select(["ref"], CreateIndex({"name": "_cache_optimised_test_index_0"}))}, {"var1": Select(["ref"], CreateRole({"name": "test_role", "privileges": {"resource": Var("var0"), "actions": {"read": true}}}))}], Map(["2022-12-08T19:45:58.674Z", "2022-12-08T19:45:58.685Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
      'Let([], Map(["2022-12-08T19:45:58.691Z", "2022-12-08T19:45:58.699Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
      'Let([{"var0": Select(["ref"], Delete(Index("_cache_optimised_test_index_0")))}, {"var1": Select(["ref"], CreateRole({"privileges": {}, "data": null, "membership": null, "name": "test_role_2"}))}, {"var2": Select(["ref"], Update(Role("test_role"), {"privileges": {}, "data": null, "membership": null}))}], Map(["2022-12-08T19:45:58.706Z", "2022-12-08T19:45:58.708Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
      'Let([{"var0": Select(["ref"], CreateIndex({"name": "test_index"}))}, {"var1": Select(["ref"], Update(Role("test_role_2"), {"privileges": {"resource": Var("var0"), "actions": {"read": true}}, "data": null, "membership": null}))}, {"var2": Select(["ref"], Update(Role("test_role"), {"privileges": {"resource": Var("var0"), "actions": {"read": true}}, "data": null, "membership": null}))}], Map(["2022-12-08T19:45:58.710Z"], Lambda("migration", Create(Collection("migrations"), {"data": {"migration": Var("migration")}}))))',
    ]

> Snapshot 3

    [
      '{"target":"2022-12-08T19:45:58.685Z","stepSize":2,"isComplete":true,"migrations":["2022-12-08T19:45:58.674Z","2022-12-08T19:45:58.685Z"],"isOptimised":true}',
      '{"from":"2022-12-08T19:45:58.685Z","target":"2022-12-08T19:45:58.699Z","stepSize":2,"isComplete":true,"migrations":["2022-12-08T19:45:58.691Z","2022-12-08T19:45:58.699Z"],"isOptimised":true}',
      '{"from":"2022-12-08T19:45:58.699Z","target":"2022-12-08T19:45:58.708Z","stepSize":2,"isComplete":true,"migrations":["2022-12-08T19:45:58.706Z","2022-12-08T19:45:58.708Z"],"isOptimised":true}',
      '{"from":"2022-12-08T19:45:58.708Z","target":"2022-12-08T19:45:58.710Z","stepSize":2,"isComplete":false,"migrations":["2022-12-08T19:45:58.710Z"]}',
    ]
