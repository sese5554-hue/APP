import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = TestConnectionViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// A native toolbar stays available when the PC is offline or its address changes.
final class TestConnectionViewController: UIViewController {
    private let serverKey = "GeunchaTestServer"
    private let content = UIView()
    private var testBridge: TestBridgeViewController?
    private var askedForServer = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let settings = UIButton(type: .system)
        settings.setTitle("PC 연결 주소 설정", for: .normal)
        settings.addTarget(self, action: #selector(chooseServer), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [settings, content])
        stack.axis = .vertical
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            settings.heightAnchor.constraint(equalToConstant: 44)
        ])
        if let saved = UserDefaults.standard.string(forKey: serverKey) {
            connect(to: saved)
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if testBridge == nil && !askedForServer && presentedViewController == nil {
            askedForServer = true
            chooseServer()
        }
    }

    @objc private func chooseServer() {
        let alert = UIAlertController(title: "테스트할 PC 연결",
            message: "PC에서 Geuncha Mobile Test를 실행하고 표시되는 PHONE URL 또는 SCREEN TEST URL을 입력하세요. 같은 Wi-Fi에 연결해야 합니다.", preferredStyle: .alert)
        alert.addTextField { field in
            field.placeholder = "http://192.0.2.10:3001"
            field.text = UserDefaults.standard.string(forKey: self.serverKey)
            field.keyboardType = .URL
            field.autocapitalizationType = .none
            field.autocorrectionType = .no
        }
        alert.addAction(UIAlertAction(title: "취소", style: .cancel))
        alert.addAction(UIAlertAction(title: "연결", style: .default) { [weak self] _ in
            guard let self else { return }
            let value = alert.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard var parts = URLComponents(string: value),
                  let scheme = parts.scheme, ["http", "https"].contains(scheme),
                  let host = parts.host, !host.isEmpty,
                  parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
                  ["", "/", "/mobile-test"].contains(parts.path) else {
                self.showError("PC에 표시된 http://주소:포트 형식으로 입력하세요.")
                return
            }
            #if !DEBUG
            guard scheme == "https" else {
                self.showError("LAN HTTP 테스트는 Xcode의 Debug 구성으로 실행하세요. Release는 HTTPS 주소를 사용합니다.")
                return
            }
            #endif
            parts.path = ""
            guard let url = parts.url else { self.showError("주소를 확인해 주세요."); return }
            UserDefaults.standard.set(url.absoluteString, forKey: self.serverKey)
            self.connect(to: url.absoluteString)
        })
        present(alert, animated: true)
    }

    private func showError(_ message: String) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            guard let self else { return }
            let alert = UIAlertController(title: "연결 주소 확인", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "다시 입력", style: .default) { [weak self] _ in
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { self?.chooseServer() }
            })
            self.present(alert, animated: true)
        }
    }

    private func connect(to server: String) {
        if let previous = testBridge {
            previous.willMove(toParent: nil)
            previous.view.removeFromSuperview()
            previous.removeFromParent()
        }
        let next = TestBridgeViewController()
        next.testServer = server
        addChild(next)
        content.addSubview(next.view)
        next.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            next.view.topAnchor.constraint(equalTo: content.topAnchor),
            next.view.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            next.view.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            next.view.trailingAnchor.constraint(equalTo: content.trailingAnchor)
        ])
        next.didMove(toParent: self)
        testBridge = next
    }
}

final class TestBridgeViewController: CAPBridgeViewController {
    var testServer: String?
    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        descriptor.serverURL = testServer
        descriptor.appStartPath = "/mobile-test"
        return descriptor
    }
}
