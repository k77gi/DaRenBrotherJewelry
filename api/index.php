<?php
require __DIR__ . '/../app/bootstrap.php';
require __DIR__ . '/../app/routes.php';

try {
    ensure_db();
    dispatch(request_method(), request_path());
    fail(404, '找不到這個介面');
} catch (HttpError $error) {
    json_out(array('error' => $error->getMessage()), $error->status);
} catch (PDOException $error) {
    json_out(array('error' => db_problem_text($error)), 500);
} catch (Exception $error) {
    json_out(array('error' => '伺服器發生錯誤，請稍後再試'), 500);
}
