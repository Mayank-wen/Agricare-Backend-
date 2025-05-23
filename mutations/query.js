const { User, Product, Order } = require("../models");

const resolvers = {
  Query: {
    // User Queries
    getUser: async (_, { id }, { user }) => {
      if (!user) throw new Error("Not authenticated");
      // If id is "me", use the authenticated user's ID
      const userId = id === "me" ? user.id : id;
      return await User.findById(userId);
    },

    // Product Queries - Remove seller population
    getProducts: async () => {
      try {
        const products = await Product.find().populate("seller").exec();

        // Filter out products with null sellers
        const validProducts = products.filter((product) => product.seller);

        console.log(`Total products found: ${products.length}`);
        console.log(`Valid products with sellers: ${validProducts.length}`);

        return validProducts;
      } catch (error) {
        console.error("Error fetching products:", error);
        throw new Error("Failed to fetch products");
      }
    },

    getProduct: async (_, { id }) => {
      return await Product.findById(id);
    },

    getProductsByCategory: async (_, { category }) => {
      return await Product.find({ category });
    },

    getUserProducts: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return await Product.find();
    },

    // Remove role check from orders
    getFarmerOrders: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");

      return await Order.find({
        "products.product": {
          $in: await Product.find({ seller: user.id }).select("_id"),
        },
      })
        .populate("buyer")
        .populate("products.product");
    },

    getBuyerOrders: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return await Order.find({ buyer: user.id })
        .populate("products.product")
        .populate({
          path: "products.product",
          populate: {
            path: "seller",
          },
        });
    },

    // Transaction Queries
    getTransactions: async (_, __, { user }) => {
      if (!user || user.role !== "farmer") {
        throw new Error("Not authorized");
      }
      const farmerProducts = await Product.find({ seller: user.id }).select(
        "_id"
      );
      return await Order.find({
        "products.product": { $in: farmerProducts },
        status: { $in: ["completed", "delivered"] },
      })
        .populate("buyer")
        .populate("products.product");
    },

    // Dashboard Stats - Remove role check
    getDashboardStats: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");

      const stats = {
        totalOrders: 0,
        totalRevenue: 0,
        activeListings: 0,
        recentTransactions: [],
      };

      const products = await Product.find();
      stats.activeListings = products.length;

      const orders = await Order.find({
        status: "completed",
      }).populate("buyer");

      stats.totalOrders = orders.length;
      stats.totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
      stats.recentTransactions = orders.slice(0, 5);

      return stats;
    },
  },
};

module.exports = resolvers;
