// Express 4는 async 라우트 핸들러의 예외를 자동으로 catch하지 않아 unhandled rejection으로 이어진다.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(err);
      if (!res.headersSent) {
        res.status(500).json({ status: 'error', error_code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' });
      }
    });
  };
}
